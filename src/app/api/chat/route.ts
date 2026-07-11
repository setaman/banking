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

import { getAiConfig } from "@/config/ai";
import { resolveModel } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { financeTools } from "@/lib/ai/tools";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOOL_STEPS = 8;
const MAX_HISTORY_PAIRS = 10;
const MAX_BODY_BYTES = 100 * 1024; // 100KB

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_MESSAGE_LENGTH),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).max(MAX_MESSAGES),
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

export async function POST(request: Request): Promise<Response> {
  const config = getAiConfig();

  if (!config) {
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

  try {
    const model = resolveModel(config);

    const result = streamText({
      model,
      system: buildSystemPrompt(),
      messages,
      tools: financeTools,
      stopWhen: stepCountIs(MAX_TOOL_STEPS),
      temperature: 0.3,
      // Errors are handled explicitly via `peekThenResume` / the outer
      // try/catch and the `toUIMessageStream` `onError` below. Suppress the
      // SDK's own default `console.error` (which dumps full stack traces
      // and request bodies) to avoid duplicate, noisier server logs.
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

    if (config.provider === "ollama" && isConnectionRefused(effective)) {
      return NextResponse.json(
        { error: "ollama_unreachable" },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: "provider_error" }, { status: 500 });
  }
}
