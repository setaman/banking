import { APICallError, RetryError } from "ai";

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
 * Matches Google's free-tier quota-exhaustion wording, e.g.:
 * "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests"
 * or the gRPC status `RESOURCE_EXHAUSTED`.
 */
const GOOGLE_FREE_TIER_RE = /quota exceeded|free_tier|resource_exhausted/i;

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
 */
export function classifyProviderError(
  error: unknown
): ProviderErrorClassification | null {
  if (!APICallError.isInstance(error)) {
    return null;
  }

  const haystack = `${error.message} ${stringifyResponseBody(error.responseBody)}`;

  if (error.statusCode === 429) {
    return {
      code: "rate_limit",
      freeTier: GOOGLE_FREE_TIER_RE.test(haystack),
      retryAfterSeconds: parseRetryDelaySeconds(haystack),
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
