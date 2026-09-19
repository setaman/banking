import {
  APICallError,
  MessageConversionError,
  RetryError,
  convertToModelMessages,
  createUIMessageStreamResponse,
  isTextUIPart,
  isToolUIPart,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type InferUITools,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import { getActiveAiProfile, getAiProfiles } from "@/config/ai";
import { resolveModel } from "@/lib/ai/provider";
import { buildSystemPrompt, type DataCoverage } from "@/lib/ai/system-prompt";
import { financeTools } from "@/lib/ai/tools";

export const maxDuration = 60;

/**
 * The app's concrete `UIMessage` type, parameterized with `financeTools`'
 * real input/output types via `InferUITools`. Needed so `safeValidateUIMessages`
 * and `convertToModelMessages` — both generic over `UI_MESSAGE extends
 * UIMessage` — validate/convert tool parts against the tools' actual typed
 * schemas rather than the library's default `UITools` (`Record<string,
 * unknown>`), which is too loose to satisfy the `tools` option's type and
 * would fail to catch a tool part whose `input`/`output` shape doesn't match
 * what `financeTools` actually declares.
 */
type ChatUIMessage = UIMessage<
  unknown,
  never,
  InferUITools<typeof financeTools>
>;

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
// Raised from 100KB: the client now sends full UIMessages, and the most
// recent `RECENT_ASSISTANT_MESSAGES_WITH_TOOLS` (see assistant/page.tsx)
// assistant turns carry their tool parts verbatim — `input`, `output`
// (which for `search_transactions`/`get_largest_expenses` can be dozens of
// transaction rows), and `callProviderMetadata`. That's real payload that
// didn't exist when the body was just flattened `{role, content}` text, so
// the old 100KB ceiling would reject ordinary multi-turn conversations, not
// just abuse. 150KB keeps this a defense against pathological/abusive
// bodies rather than a limit that a normal follow-up question can trip.
const MAX_BODY_BYTES = 150 * 1024; // 150KB

/**
 * Message-shape validation now delegates to the AI SDK's own
 * `safeValidateUIMessages` (see below, in `POST`) rather than a hand-rolled
 * zod schema — the client sends full `UIMessage[]` (parts, tool calls,
 * `callProviderMetadata`, etc.) so we want the SDK's actual `uiMessagesSchema`,
 * not a shape we'd have to keep re-deriving by hand. `profileId` isn't part
 * of the UIMessage wire shape at all (see `route.ts`'s block comment further
 * down), so it keeps its own small, standalone schema.
 */
const profileIdSchema = z.object({
  // Optional per-conversation override, letting the UI switch AI profiles
  // without writing to banking.config.json (which would change every other
  // conversation/tab too). Validated below against the actual saved
  // profiles — an unknown id is rejected as invalid_request, not silently
  // ignored. `z.object` silently strips unrecognized keys (like the
  // sibling `messages` field) rather than erroring on them, so this schema
  // can safely run against the same raw body `safeValidateUIMessages` also
  // reads from.
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
 * Concatenates every `text` part of a UI message into a single string — the
 * equivalent of the old flat `{role, content}` shape's `content` field, now
 * that message text lives in `parts` alongside tool parts.
 */
function extractMessageText(message: ChatUIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

/**
 * Keeps only the most recent `pairs` user/assistant turns so the model isn't
 * sent an unbounded conversation history — then guarantees the result starts
 * with a `user` message (or is empty), because `slice(-pairs * 2)` alone
 * cannot make that promise.
 *
 * Why the outgoing array's length is structurally ODD, not even: by the time
 * this runs, the newest user message — the question this very request is
 * answering — has already been appended to history (see `useChat`/
 * `assistant/page.tsx`). It has no assistant reply yet. So a history of N
 * answered turns plus that one in-flight question is `2N + 1` messages long,
 * not `2N`. `slice(-pairs * 2)` takes an EVEN-sized window off the end of an
 * ODD-length array, which forces the boundary to fall one message off from
 * every user/assistant pair — and on a history long enough to be trimmed at
 * all, that boundary lands on an assistant message just as often as a user
 * one. A trimmed array starting with `role: "assistant"` converts (via
 * `convertToModelMessages`) into a `ModelMessage[]` whose first entry has
 * `role: "assistant"`, which Gemini's API rejects outright as an invalid
 * first turn — a trimming bug that then surfaces as an opaque 500
 * `provider_error`, indistinguishable from an actual provider outage.
 *
 * The fix: after the length-based slice, drop leading messages until the
 * first one is `role: "user"` (or nothing is left). This never touches the
 * *end* of the array, so the in-flight user message — the actual question
 * being asked — is never at risk of being dropped; only stale history at the
 * front can be. In the overwhelmingly common case this drops exactly one
 * orphaned assistant message, costing half a pair of budget — losing one
 * turn of old context is strictly better than a hard 500. `pairs` (see
 * `MAX_HISTORY_PAIRS`) is therefore a ceiling on "roughly `pairs` exchanges",
 * not an exact guarantee.
 *
 * This counts *input* UIMessages, not the ModelMessages `convertToModelMessages`
 * later expands them into — one assistant UIMessage with several tool parts
 * becomes one `assistant` ModelMessage plus one `tool` ModelMessage per tool
 * call once converted. But on the wire, before conversion, the client still
 * sends exactly one UIMessage per user turn and one per assistant turn (see
 * `assistant/page.tsx`'s `buildOutgoingMessages`), so counting UIMessages
 * (rather than the later, expanded ModelMessages) is still the right unit to
 * trim.
 */
function trimToRecentPairs(
  messages: readonly ChatUIMessage[],
  pairs: number
): ChatUIMessage[] {
  const sliced = messages.slice(-pairs * 2);
  let firstUserIndex = 0;
  while (
    firstUserIndex < sliced.length &&
    sliced[firstUserIndex].role !== "user"
  ) {
    firstUserIndex++;
  }
  return sliced.slice(firstUserIndex);
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

/**
 * Questions about the assistant itself rather than the user's data.
 *
 * Anchored to match the ENTIRE trimmed message (not just a substring), with
 * an optional trailing "?". Previously this used a shared `\b(...)\b` group
 * around alternatives that also embedded their own `\??$`; at end-of-string
 * after a literal "?", the preceding character is non-word, so the trailing
 * `\b` failed to match, and JS regex engines do not backtrack into an
 * already-satisfied earlier alternative to drop the "?" — so "what are
 * you?", "help?", and "can you help me?" (with the "?") were silently NOT
 * exempted, forcing a pointless tool call on a pure capability question.
 * Anchoring the whole alternation with `^...\??$` fixes that and also
 * avoids the previous false positive where these phrases matched as a bare
 * substring inside an unrelated, longer data question (e.g. "who are you
 * sending money to?"). Also fixes a typo: "was kannst du( du)?" duplicated
 * "du" instead of allowing the same optional trailing "?" as every other
 * phrase here.
 */
const CAPABILITY_QUESTION_RE =
  /^(what can you do|what do you do|who are you|what are you|can you help( me)?|help|wer bist du|was kannst du|was bist du)\??$/i;

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

  // `profileId` is validated independently of `messages` (see
  // `profileIdSchema`'s doc comment) — it isn't part of the UIMessage wire
  // shape, and z.object silently drops the sibling `messages` key rather
  // than erroring on it.
  const profileParsed = profileIdSchema.safeParse(rawBody);
  if (!profileParsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // `safeValidateUIMessages` is the AI SDK's own, complete validator for the
  // `UIMessage[]` shape — tool parts, `callProviderMetadata`, states, etc.
  // included. It's strictly more thorough than a hand-rolled zod schema
  // could stay in sync with across SDK versions. `messages == null` (missing
  // field, non-object body, etc.) is itself a validation failure inside the
  // function, so no separate existence check is needed here. A rejected,
  // old-style flat `{role, content}` body — or any other malformed shape —
  // falls into this same `success: false` branch.
  const rawMessages =
    typeof rawBody === "object" && rawBody !== null
      ? (rawBody as { messages?: unknown }).messages
      : undefined;
  const validated = await safeValidateUIMessages<ChatUIMessage>({
    messages: rawMessages,
    tools: financeTools,
  });
  if (!validated.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // The SDK's `uiMessagesSchema` (used by `safeValidateUIMessages` above)
  // permits `role: "system"` in the wire shape, but the OLD hand-rolled
  // schema this replaced (`role: z.enum(["user", "assistant"])`) never did —
  // a client should never be able to inject a system-role message into the
  // conversation. This is NOT a prompt-injection hole even without this
  // guard: `streamText` refuses to forward a `system` `ModelMessage`
  // (`allowSystemInMessages` defaults to `false`), so forged content never
  // reaches the model. But that refusal throws `InvalidPromptError`, which
  // isn't a `MessageConversionError` and isn't caught below, so it would
  // fall through to the generic provider-error catch and misreport a
  // malformed *request* as a 500 provider failure. Rejecting here, before
  // conversion, restores the old schema's guarantee and reports the correct
  // 400. Reject rather than silently strip: a client sending a system
  // message is malformed, and silently accepting a request while discarding
  // part of it is worse than a clear error.
  if (validated.data.some((m) => m.role === "system")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // This app defines no approval-gated tools (see `financeTools`), so a tool
  // part in `approval-requested` or `approval-responded` state can never
  // arise from normal server-driven streaming — the only way to produce one
  // is a hand-crafted request. Both states are also a genuine validation
  // gap: `safeValidateUIMessages` only checks a tool part's `input` against
  // the tool's zod schema for `input-available`/`output-available` states,
  // so a malformed input (e.g. `{limit: "not-a-number"}`) sails through
  // unvalidated in these two states. `ignoreIncompleteToolCalls` (passed to
  // `convertToModelMessages` below) only filters `input-streaming` and
  // `input-available` — not these — so without this guard an
  // `approval-requested` part converts into an assistant tool-call with no
  // matching tool-result, and its unvalidated input gets forwarded toward
  // the model. Reject outright as malformed; `output-available`,
  // `output-error`, and `output-denied` are untouched and continue to
  // convert normally.
  const hasUnsupportedToolApprovalState = validated.data.some((m) =>
    m.parts.some(
      (part) =>
        isToolUIPart(part) &&
        (part.state === "approval-requested" ||
          part.state === "approval-responded")
    )
  );
  if (hasUnsupportedToolApprovalState) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (validated.data.length > MAX_MESSAGES) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Equivalent of the old `chatMessageSchema`'s `.max(MAX_MESSAGE_LENGTH)` on
  // flat `content`, now applied to each message's concatenated text parts —
  // tool parts (input/output) are deliberately NOT counted here, they have
  // their own, much larger, expected size (see `MAX_BODY_BYTES`'s comment).
  const hasOversizedMessage = validated.data.some(
    (m) => extractMessageText(m).length > MAX_MESSAGE_LENGTH
  );
  if (hasOversizedMessage) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const messages = trimToRecentPairs(validated.data, MAX_HISTORY_PAIRS);

  const { profileId } = profileParsed.data;
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
    ? isLikelyDataQuestion(extractMessageText(latestUserMessage))
    : false;

  try {
    const model = resolveModel(profile);
    const coverage = await getDataCoverage();

    // `convertToModelMessages` is the SDK's bridge from `UIMessage[]` (what
    // the client sends and what `streamText` no longer accepts directly) to
    // `ModelMessage[]` (what it does accept). It throws `MessageConversionError`
    // for a shape it can't convert (e.g. an incomplete tool call left in a
    // state it doesn't know how to translate) — that reflects a malformed
    // *request*, not a provider/server failure, so it's caught here and
    // reported as 400 rather than falling through to the provider-error
    // catch below, which would misreport it as a 500.
    let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
    try {
      modelMessages = await convertToModelMessages(messages, {
        tools: financeTools,
        ignoreIncompleteToolCalls: true,
      });
    } catch (conversionError) {
      if (MessageConversionError.isInstance(conversionError)) {
        return NextResponse.json({ error: "invalid_request" }, { status: 400 });
      }
      throw conversionError;
    }

    const result = streamText({
      model,
      system: buildSystemPrompt(coverage),
      messages: modelMessages,
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
