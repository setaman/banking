import { APICallError, RetryError } from "ai";

import type { AiProvider } from "@/config/ai";

// ---------------------------------------------------------------------------
// Provider error classification (Gemini free-tier hardening)
//
// `streamText` retries transient failures internally (see `route.ts`'s
// `maxRetries` override) and, if every attempt fails, throws a `RetryError`
// wrapping the underlying provider error. On Google's free tier a 429 is
// virtually never transient within the SDK's default 2s/4s backoff window —
// Google's own cooldown is typically ~17s+ — so the goal here is to detect
// that specific case and hand the UI enough information (a friendly code,
// whether it's specifically the free-tier quota, and how long to wait) to
// show something better than a generic failure.
// ---------------------------------------------------------------------------

/** Unwraps a `RetryError` to the real provider error it wraps, if any. */
export function unwrapProviderError(error: unknown): unknown {
  return RetryError.isInstance(error) ? error.lastError : error;
}

export type ProviderErrorClassification =
  | {
      readonly code: "rate_limit";
      /** True when the error text matches Google's free-tier quota wording. */
      readonly freeTier: boolean;
      /** Seconds to wait before retrying, parsed from the provider's own message/body, if present. */
      readonly retryAfterSeconds?: number;
    }
  | {
      readonly code: "provider_overloaded";
    };

/**
 * Matches Google's free-tier-SPECIFIC quota identifier, e.g. the metric name
 * in "Quota exceeded for metric:
 * generativelanguage.googleapis.com/generate_content_free_tier_requests".
 *
 * Deliberately narrow: generic quota wording ("quota exceeded",
 * `RESOURCE_EXHAUSTED`) is common to any provider's/tier's 429 and is NOT
 * free-tier-specific — a paid Google plan or a wholly different provider can
 * hit those same words for an unrelated quota. Only this identifier, which
 * Google's API only emits for the free tier's per-minute request quota,
 * is a reliable signal.
 */
const GOOGLE_FREE_TIER_RE = /free_tier/i;

/** Matches provider "server is overloaded" wording across 500/503/529 responses. */
const OVERLOADED_RE = /overloaded|high demand/i;

/**
 * Parses a retry delay out of provider error text. Handles both forms seen
 * in the wild:
 * - Google's plain-English suffix: "Please retry in 16.907094553s."
 * - The structured `RetryInfo` field some providers echo into the body/message: `"retryDelay": "16s"`
 *
 * Returns a ceiling'd whole-second count (never fractional — the UI shows a
 * simple integer countdown), or `undefined` if no delay could be found.
 */
function parseRetryDelaySeconds(text: string): number | undefined {
  const retryInMatch = text.match(/retry in\s+(\d+(?:\.\d+)?)\s*s/i);
  if (retryInMatch) {
    return Math.ceil(parseFloat(retryInMatch[1]));
  }
  const retryDelayMatch = text.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (retryDelayMatch) {
    return Math.ceil(parseFloat(retryDelayMatch[1]));
  }
  return undefined;
}

/**
 * Case-insensitively reads a header out of an `APICallError.responseHeaders`
 * record. The AI SDK doesn't guarantee a casing convention for the keys it
 * stores there, and HTTP header names are themselves case-insensitive, so a
 * plain `headers[name]` lookup would miss e.g. `Retry-After`.
 */
function getHeaderCaseInsensitive(
  headers: Record<string, string> | undefined,
  name: string
): string | undefined {
  if (!headers) {
    return undefined;
  }
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key !== undefined ? headers[key] : undefined;
}

/**
 * Falls back to the standard `Retry-After` (seconds or an HTTP-date) or the
 * non-standard `Retry-After-Ms` response header when the provider's error
 * text carried no parseable delay (see `parseRetryDelaySeconds`, which is
 * always tried first — this is strictly a fallback). Ceils to a whole
 * second; returns `undefined` for a missing, negative, or unparseable value
 * rather than ever surfacing a nonsensical negative/NaN wait.
 */
function parseRetryAfterHeader(
  headers: Record<string, string> | undefined
): number | undefined {
  const retryAfterMs = getHeaderCaseInsensitive(headers, "retry-after-ms");
  if (retryAfterMs !== undefined) {
    const ms = Number(retryAfterMs);
    if (Number.isFinite(ms) && ms >= 0) {
      return Math.ceil(ms / 1000);
    }
  }

  const retryAfter = getHeaderCaseInsensitive(headers, "retry-after");
  if (retryAfter === undefined) {
    return undefined;
  }
  const trimmed = retryAfter.trim();

  // Delta-seconds form, e.g. "Retry-After: 20".
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) && seconds >= 0
      ? Math.ceil(seconds)
      : undefined;
  }

  // HTTP-date form, e.g. "Retry-After: Wed, 21 Oct 2026 07:28:00 GMT".
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) {
    return undefined;
  }
  const deltaSeconds = Math.ceil((dateMs - Date.now()) / 1000);
  return deltaSeconds >= 0 ? deltaSeconds : undefined;
}

/** Renders an `APICallError`'s `responseBody` (string, object, or absent) into searchable text. */
function stringifyResponseBody(body: unknown): string {
  if (body == null) {
    return "";
  }
  if (typeof body === "string") {
    return body;
  }
  try {
    return JSON.stringify(body);
  } catch {
    return "";
  }
}

/**
 * Classifies an already-unwrapped provider error (pass it through
 * `unwrapProviderError` first) into a `rate_limit` or `provider_overloaded`
 * outcome, or `null` if it's neither — in which case the caller falls back
 * to its own existing handling (auth, connection-refused, generic 500).
 *
 * `provider` is the profile's configured `AiProvider` (see `@/config/ai`),
 * needed because `freeTier` must only ever be set for Google: the free-tier
 * identifier `GOOGLE_FREE_TIER_RE` matches is Google-specific wording, but
 * gating on the provider too (rather than the text alone) is the only way to
 * rule out a coincidental match from a wholly different provider's error
 * text.
 */
export function classifyProviderError(
  error: unknown,
  provider: AiProvider
): ProviderErrorClassification | null {
  if (!APICallError.isInstance(error)) {
    return null;
  }

  const haystack = `${error.message} ${stringifyResponseBody(error.responseBody)}`;

  if (error.statusCode === 429) {
    return {
      code: "rate_limit",
      freeTier: provider === "google" && GOOGLE_FREE_TIER_RE.test(haystack),
      retryAfterSeconds:
        parseRetryDelaySeconds(haystack) ??
        parseRetryAfterHeader(error.responseHeaders),
    };
  }

  const isOverloaded =
    error.statusCode === 503 ||
    ((error.statusCode === 500 || error.statusCode === 529) &&
      OVERLOADED_RE.test(haystack));
  if (isOverloaded) {
    return { code: "provider_overloaded" };
  }

  return null;
}
