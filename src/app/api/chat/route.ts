import {
  APICallError,
  RetryError,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import { getActiveAiProfile, getAiProfiles } from "@/config/ai";
import { resolveModel } from "@/lib/ai/provider";
import { buildSystemPrompt, type DataCoverage } from "@/lib/ai/system-prompt";
import { financeTools } from "@/lib/ai/tools";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
// Raised from 8: a multi-tool financial question (e.g. compare two periods,
// or gather several aggregates before composing an answer) can legitimately
// need more than a handful of steps. Each tool round-trip costs one "tool
// call" step plus one "continue" step, so 8 left barely two tool calls of
// headroom before the model was forced to answer regardless of whether it
// had enough data — precisely the gap that produced the invented vacation
// transactions. 12 gives room for ~5 tool calls plus a final composition
// step while staying well within `maxDuration` (60s) and, per the grounding
// rules in the system prompt, an exhausted budget must be reported honestly
// rather than papered over with estimates.
const MAX_TOOL_STEPS = 12;
const MAX_HISTORY_PAIRS = 10;
const MAX_BODY_BYTES = 100 * 1024; // 100KB

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_MESSAGE_LENGTH),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).max(MAX_MESSAGES),
  // Optional per-conversation override, letting the UI switch AI profiles
  // without writing to banking.config.json (which would change every other
  // conversation/tab too). Validated below against the actual saved
  // profiles — an unknown id is rejected as invalid_request, not silently
  // ignored.
  profileId: z.string().trim().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Local rate limiting
//
// A simple in-memory sliding-window limiter, independent of any rate limit
// the upstream AI provider itself may impose (see the `rate_limit` code
// returned from the outer catch below for that case). This one exists to
// protect the local dev/production server from being hammered with request
// volume regardless of provider — e.g. a buggy client retry loop — before a
// single token is ever sent upstream.
//
// In-memory only: resets on server restart and is per-process (fine for
// this app's single-instance, local-first deployment model; would need a
// shared store — Redis, etc. — behind a multi-instance deployment).
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

/** Request timestamps (ms since epoch) per client key, most recent last. */
const requestTimestamps = new Map<string, number[]>();

/** Best-effort client key: the first hop of X-Forwarded-For, else a constant. */
function getClientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstHop = forwardedFor?.split(",")[0]?.trim();
  return firstHop || "local";
}

/**
 * Records a request for `key` and reports whether it exceeds
 * `RATE_LIMIT_MAX_REQUESTS` within the trailing `RATE_LIMIT_WINDOW_MS`.
 */
function isRateLimited(key: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (requestTimestamps.get(key) ?? []).filter(
    (t) => t > windowStart
  );
  recent.push(now);
  requestTimestamps.set(key, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Keeps only the most recent `pairs` user/assistant turns (2 messages per
 * turn) so the model isn't sent an unbounded conversation history.
 */
function trimToRecentPairs(
  messages: readonly { role: "user" | "assistant"; content: string }[],
  pairs: number
): { role: "user" | "assistant"; content: string }[] {
  return messages.slice(-pairs * 2);
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * `streamText` retries transient failures internally and, if every attempt
 * fails, throws a `RetryError` wrapping the underlying provider error.
 * Unwraps it so status-code/connection checks below see the real cause.
 */
function unwrapProviderError(error: unknown): unknown {
  return RetryError.isInstance(error) ? error.lastError : error;
}

/**
 * Detects a connection-refused error, which for the Ollama provider means
 * the local server isn't running at the configured base URL.
 */
function isConnectionRefused(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const cause = (error as { cause?: unknown }).cause;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause
      ? (cause as { code?: unknown }).code
      : undefined;
  return (
    causeCode === "ECONNREFUSED" ||
    /ECONNREFUSED|fetch failed/i.test(error.message)
  );
}

/**
 * Reads from `stream` until it has seen something beyond the initial
 * lifecycle markers (`"start"`, `"start-step"`) or the stream ends,
 * buffering everything read so far.
 *
 * `streamText` emits those markers eagerly, before the underlying HTTP call
 * to the provider has actually succeeded. When tools/multi-step are in
 * play (as here), a failed provider call — auth error, rate limit,
 * connection refused, exhausted retries — does *not* throw from the
 * reader; it arrives as a normal, non-throwing `{ type: "error", error }`
 * chunk. Peeking past the lifecycle markers and explicitly re-throwing that
 * chunk's `error` lets a genuinely failed request surface as a real
 * exception (caught by the route's try/catch and mapped to a proper HTTP
 * status) instead of silently becoming a 200 response whose body just
 * happens to contain an error part.
 *
 * If the stream is healthy, returns a new stream that replays the buffered
 * chunk(s) followed by the remainder of the original stream, so no content
 * is lost. Errors that occur *after* this point — once the response has
 * already been committed as a 200 — are inherently embedded in the UI
 * message stream by `toUIMessageStream`, since the HTTP status can no
 * longer change at that point.
 */
// Lifecycle markers emitted before the model actually produces content (or
// fails). Neither implies the underlying provider request succeeded, so
// peeking must skip past both before it can trust the stream is healthy.
const BENIGN_LEADING_CHUNK_TYPES = new Set(["start", "start-step"]);

async function peekThenResume<T extends { type: string; error?: unknown }>(
  source: ReadableStream<T>
): Promise<ReadableStream<T>> {
  const reader = source.getReader();
  const buffered: T[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffered.push(value);
    if (value.type === "error") {
      throw value.error;
    }
    if (!BENIGN_LEADING_CHUNK_TYPES.has(value.type)) {
      break;
    }
  }

  return new ReadableStream<T>({
    async start(controller) {
      for (const chunk of buffered) {
        controller.enqueue(chunk);
      }
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Grounding gate: require a tool call before the model may answer a data
// question (Fix B1)
//
// AI SDK v7's `streamText` accepts a `prepareStep` callback — see
// `PrepareStepFunction`/`PrepareStepResult` in `node_modules/ai/dist/index.d.ts`
// — that can override `toolChoice` (among other things) per step, where
// `stepNumber` is 0-indexed (the SDK's internal loop passes
// `stepNumber: recordedSteps.length`). `ToolChoice<TOOLS>` includes the
// literal `"required"`, which forces the model to call *some* tool that step
// without pinning it to a specific one, so the model still picks whichever
// tool fits per the system prompt's guidance.
//
// We force `toolChoice: "required"` ONLY on step 0. Forcing it on every step
// would be a trap: the model would be told "you must call a tool" again
// after it already has the facts it needs, and — since `stopWhen` still
// eventually cuts it off — it would either loop until the step budget is
// exhausted or be forced to call a pointless extra tool instead of ever
// emitting final text. Restricting the requirement to the first step
// guarantees at least one real tool call grounds the answer, while every
// later step falls back to `undefined` (which inherits the outer, unset
// `toolChoice`, i.e. the SDK default `"auto"`), letting the model compose
// its final response freely once it has data.
//
// Whether step 0 requires a tool depends on a conservative, cheap heuristic:
// bias toward requiring a tool whenever it's plausible the user is asking
// about their own financial data, since a needless lookup is harmless but a
// fabricated number is not. Only a small, explicit allowlist of
// conversational/non-data turns is exempted so they stay natural instead of
// triggering a spurious database query.
// ---------------------------------------------------------------------------

/** Short conversational openers/closers that never concern the user's data. */
const GREETING_OR_ACK_RE =
  /^(hi|hello|hey|hallo|servus|moin|thanks?( you)?( very much)?|thank you( very much)?|many thanks|danke( dir| schön| sehr)?|dankeschön|ok|okay|cool|great|nice|good|got it|alles klar|verstanden|bye|goodbye|tschüss|sorry|sry|no worries)[!.,\s]*$/i;

/** Questions about the assistant itself rather than the user's data. */
const CAPABILITY_QUESTION_RE =
  /\b(what can you do|what do you do|who are you|what are you\??$|can you help( me)?\??$|help\??$|wer bist du|was kannst du( du)?|was bist du)\b/i;

/**
 * A generic "define/explain this concept" question (e.g. "what is a savings
 * rate?", "explain compound interest"). Educational and answerable from
 * general knowledge — UNLESS it also references the user's own data (see
 * `PERSONAL_REFERENCE_RE`), e.g. "what's my savings rate?" is a data
 * question, not a definition request.
 */
const CONCEPTUAL_QUESTION_RE =
  /^(what('?s| is)\b|explain\b|define\b|how (does|do|is)\b)/i;

/** A first- or second-person possessive/subject reference to the user's own finances. */
const PERSONAL_REFERENCE_RE =
  /\b(my|mine|i'?ve|i have|i spent|i earned|i paid|did i|am i|ich|mein\w*|habe ich)\b/i;

/**
 * Conservative, cheap heuristic for "does this turn plausibly concern the
 * user's own financial data?" Used only to decide whether step 0 of the
 * agent loop must call a tool — see the block comment above. Defaults to
 * `true` (require a tool) whenever the message isn't a recognized
 * conversational or purely-conceptual turn.
 */
function isLikelyDataQuestion(latestUserText: string): boolean {
  const trimmed = latestUserText.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (
    GREETING_OR_ACK_RE.test(trimmed) ||
    CAPABILITY_QUESTION_RE.test(trimmed)
  ) {
    return false;
  }
  if (
    CONCEPTUAL_QUESTION_RE.test(trimmed) &&
    !PERSONAL_REFERENCE_RE.test(trimmed)
  ) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Data coverage (Fix B4-e): the earliest/latest transaction date, injected
// into the system prompt so the model can tell whether a time-based question
// is even answerable instead of silently assuming data exists. Computed here
// (route.ts already has DB access via the existing `getTransactions` action)
// rather than inside the prompt module, per the task's guidance — keeps
// `buildSystemPrompt` synchronous and free of DB imports.
// ---------------------------------------------------------------------------

async function getDataCoverage(): Promise<DataCoverage> {
  const transactions = await getTransactions();
  if (transactions.length === 0) {
    return { earliestDate: null, latestDate: null };
  }
  // `getTransactions()` returns transactions sorted most-recent-first.
  return {
    earliestDate: transactions[transactions.length - 1].bookingDate,
    latestDate: transactions[0].bookingDate,
  };
}

export async function POST(request: Request): Promise<Response> {
  const profiles = getAiProfiles();

  if (profiles.length === 0) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  if (isRateLimited(getClientKey(request))) {
    return NextResponse.json({ error: "rate_limit_local" }, { status: 429 });
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (new TextEncoder().encode(rawText).length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const messages = trimToRecentPairs(parsed.data.messages, MAX_HISTORY_PAIRS);

  const { profileId } = parsed.data;
  const profile = profileId
    ? profiles.find((p) => p.id === profileId)
    : getActiveAiProfile();

  if (!profile) {
    return NextResponse.json(
      { error: profileId ? "invalid_request" : "not_configured" },
      { status: profileId ? 400 : 503 }
    );
  }

  const latestUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const requireToolOnFirstStep = latestUserMessage
    ? isLikelyDataQuestion(latestUserMessage.content)
    : false;

  try {
    const model = resolveModel(profile);
    const coverage = await getDataCoverage();

    const result = streamText({
      model,
      system: buildSystemPrompt(coverage),
      messages,
      tools: financeTools,
      stopWhen: stepCountIs(MAX_TOOL_STEPS),
      // Lowered from 0.3: this is a factual assistant that reports numbers
      // out of tool results, not a creative writer — less sampling variance
      // reduces the odds of the model drifting into confident-sounding but
      // ungrounded phrasing around a number. Not 0: a small amount of
      // temperature keeps phrasing natural and avoids the occasional
      // degenerate/repetitive output some providers exhibit at strict
      // greedy decoding, and grounding here is enforced structurally (B1/B4)
      // rather than by temperature alone.
      temperature: 0.1,
      // See the grounding-gate block comment above `isLikelyDataQuestion`:
      // require a tool call on step 0 only when the turn plausibly concerns
      // the user's data, then hand control back to the default "auto" so
      // the model can compose its final answer once it has facts in hand.
      prepareStep: ({ stepNumber }) =>
        stepNumber === 0 && requireToolOnFirstStep
          ? { toolChoice: "required" as const }
          : undefined,
      // Dedicated hook for logging tool execution outcomes (Fix B3): unlike
      // `streamText`'s own `onError` below (which only fires for top-level
      // stream errors — a failed provider call — never for an individual
      // tool's `execute` throwing), `onToolExecutionEnd` fires for every
      // tool call, success or failure, and is the SDK's documented
      // mechanism for exactly this. A concise, tool-scoped log line here is
      // the only piece actually missing: the SDK already turns a thrown
      // tool error into an explicit `tool-result` with `errorMode: "text"`
      // that's fed back to the model on the next step (see
      // `createToolModelOutput`/the `"tool-error"` case in
      // `node_modules/ai/dist/index.js`), so the model already sees the
      // failure and can report it honestly per the system prompt's Hard
      // Rules — no code change was needed for that part, only for surfacing
      // it in the server logs. No secrets are logged: only the tool name
      // and the error's `message`.
      onToolExecutionEnd: (event) => {
        if (event.toolOutput.type === "tool-error") {
          const message =
            event.toolOutput.error instanceof Error
              ? event.toolOutput.error.message
              : "unknown tool error";
          console.error(
            `Tool execution failed (${event.toolOutput.toolName}):`,
            message
          );
        }
      },
      // Errors are handled explicitly via `peekThenResume` / the outer
      // try/catch and the `toUIMessageStream` `onError` below. Suppress the
      // SDK's own default `console.error` (which dumps full stack traces
      // and request bodies) to avoid duplicate, noisier server logs. This
      // only affects top-level stream errors (e.g. a failed provider call)
      // — it never receives tool execution errors (see `onToolExecutionEnd`
      // above), so it does not regress B3.
      onError: () => {},
    });

    const resumedStream = await peekThenResume(result.stream);

    const uiStream = toUIMessageStream({
      stream: resumedStream,
      tools: financeTools,
      onError: (error) => {
        console.error(
          "Chat stream error (mid-stream):",
          error instanceof Error ? error.message : "unknown error"
        );
        return "An error occurred while generating the response.";
      },
    });

    return createUIMessageStreamResponse({ stream: uiStream });
  } catch (error) {
    const effective = unwrapProviderError(error);

    console.error(
      "Chat API error:",
      effective instanceof Error ? effective.message : "unknown error"
    );

    if (APICallError.isInstance(effective)) {
      if (effective.statusCode === 401 || effective.statusCode === 403) {
        return NextResponse.json({ error: "auth" }, { status: 401 });
      }
      if (effective.statusCode === 429) {
        return NextResponse.json({ error: "rate_limit" }, { status: 429 });
      }
    }

    if (profile.provider === "ollama" && isConnectionRefused(effective)) {
      return NextResponse.json(
        { error: "ollama_unreachable" },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: "provider_error" }, { status: 500 });
  }
}
