"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Error code mapping (docs/design/ai-assistant-ui.md §7)
//
// The `/api/chat` route returns a JSON body `{ error: <code>, ... }` with a
// non-2xx status on failure (pre-stream failures) or embeds that same JSON
// as the stream's error text (mid-stream failures — see `route.ts`'s
// `toUIMessageStream` `onError`). The AI SDK's `HttpChatTransport` throws
// `new Error(await response.text())`, so `error.message` is that raw JSON
// text (or a generic fetch-failure string for actual network errors). This
// module recovers the code — and, for `rate_limit`, any accompanying
// `retryAfterSeconds`/`freeTier` hints — from that message and maps it to a
// friendly, actionable message.
// ---------------------------------------------------------------------------

export type ChatErrorCode =
  | "not_configured"
  | "auth"
  | "rate_limit"
  | "rate_limit_local"
  | "ollama_unreachable"
  | "provider_overloaded"
  | "provider_error"
  | "invalid_request"
  | "stream_error"
  | "network";

const KNOWN_CODES = new Set<ChatErrorCode>([
  "not_configured",
  "auth",
  "rate_limit",
  "rate_limit_local",
  "ollama_unreachable",
  "provider_overloaded",
  "provider_error",
  "invalid_request",
  "stream_error",
  "network",
]);

/** The result of classifying a chat error: its code, plus any details the server attached. */
export interface ParsedChatError {
  readonly code: ChatErrorCode;
  /** Seconds to wait before retrying, if the server could parse one from the provider's error. */
  readonly retryAfterSeconds?: number;
  /** True when a `rate_limit` specifically matched Google's free-tier quota wording. */
  readonly freeTier?: boolean;
}

/**
 * Extracts a known error code (and any accompanying `retryAfterSeconds`/
 * `freeTier` hints) from a route/network error, defaulting to `{ code:
 * "network" }` for anything that isn't a recognized JSON error body.
 */
export function classifyChatError(error: Error): ParsedChatError {
  try {
    const parsed: unknown = JSON.parse(error.message);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { error?: unknown }).error === "string" &&
      KNOWN_CODES.has((parsed as { error: string }).error as ChatErrorCode)
    ) {
      const body = parsed as {
        error: ChatErrorCode;
        retryAfterSeconds?: unknown;
        freeTier?: unknown;
      };
      return {
        code: body.error,
        retryAfterSeconds:
          typeof body.retryAfterSeconds === "number" &&
          Number.isFinite(body.retryAfterSeconds)
            ? body.retryAfterSeconds
            : undefined,
        freeTier:
          typeof body.freeTier === "boolean" ? body.freeTier : undefined,
      };
    }
  } catch {
    // Not a JSON error body — fall through to a network-error default.
  }
  return { code: "network" };
}

/** Messages that never vary with a countdown — every other code goes through `describeChatError` below. */
const STATIC_ERROR_MESSAGES: Record<
  Exclude<ChatErrorCode, "rate_limit" | "provider_overloaded">,
  string
> = {
  not_configured:
    "The AI assistant isn't configured yet. Add a provider and API key in Settings.",
  auth: "Authentication failed. Check that your API key in Settings is correct and active.",
  rate_limit_local:
    "You're sending messages too quickly. Please wait a minute and try again.",
  ollama_unreachable:
    "Could not reach your local Ollama server. Make sure it's running and the model is pulled.",
  provider_error: "The AI provider returned an error. Please try again.",
  invalid_request: "That message couldn't be processed. Try rephrasing it.",
  stream_error: "The response was interrupted by an error. Please try again.",
  network: "Could not reach the server. Check your connection and try again.",
};

/**
 * Builds the user-facing message for a chat error, given a live countdown
 * (seconds remaining until the provider's rate limit window clears, `null`
 * once it's finished counting down or no delay was ever known). Only
 * `rate_limit` and `provider_overloaded` vary their wording based on
 * `freeTier`/the countdown — every other code has a fixed message.
 */
function describeChatError(
  parsed: ParsedChatError,
  secondsRemaining: number | null
): string {
  if (parsed.code === "rate_limit") {
    if (parsed.freeTier) {
      if (secondsRemaining === null) {
        return "Gemini free-tier limit reached (5 requests per minute). Please wait a moment and try again.";
      }
      return secondsRemaining > 0
        ? `Gemini free-tier limit reached (5 requests per minute). Try again in ${secondsRemaining}s.`
        : "Gemini free-tier limit reached (5 requests per minute). You can try again now.";
    }
    if (secondsRemaining === null) {
      return "Rate limited by the AI provider. Please wait a moment and try again.";
    }
    return secondsRemaining > 0
      ? `Rate limited by the AI provider. Try again in ${secondsRemaining}s.`
      : "Rate limited by the AI provider. You can try again now.";
  }

  if (parsed.code === "provider_overloaded") {
    // Deliberately generic rather than naming "Gemini": unlike `rate_limit`'s
    // `freeTier` flag, `provider_overloaded` carries no signal that this was
    // specifically Google — a 503/"overloaded" response could come from any
    // configured provider.
    return "The AI provider is busy right now — this is usually temporary. Try again in a moment.";
  }

  return STATIC_ERROR_MESSAGES[parsed.code];
}

/** Title shown above the message — most codes share the generic default. */
function titleForChatError(code: ChatErrorCode): string {
  if (code === "rate_limit") {
    return "Request limit reached";
  }
  if (code === "provider_overloaded") {
    return "AI provider busy";
  }
  return "Failed to get a response";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ChatErrorBannerProps {
  readonly error: Error;
  readonly onRetry: () => void;
  readonly onDismiss: () => void;
}

export function ChatErrorBanner({
  error,
  onRetry,
  onDismiss,
}: ChatErrorBannerProps): React.JSX.Element {
  const parsed = useMemo(() => classifyChatError(error), [error]);

  // Live countdown, seeded from the server's `retryAfterSeconds` (if any) and
  // re-seeded whenever a genuinely new error comes in. `null` means "no
  // known delay" — as opposed to `0`, which means "the delay has elapsed" —
  // so the two render different text (see `describeChatError`).
  //
  // Re-seeding on a new `error` is done during render (the "adjusting state
  // when a prop changes" pattern from the React docs: track the previous
  // `error` in state and, if it differs, call `setState` directly in the
  // render body) rather than in a `useEffect`. `error` identity changes
  // exactly once per distinct failure, so this never loops — but doing the
  // reset inside an Effect would call `setState` synchronously in the
  // Effect's body, which triggers an extra, avoidable render pass.
  //
  // The countdown is anchored to a fixed `retryDeadline` timestamp (`Date.now()
  // + retryAfterSeconds * 1000`) rather than decrementing `secondsRemaining`
  // by 1 every tick: a `setTimeout` scheduled from a backgrounded/throttled
  // tab can fire many seconds late (browsers clamp inactive-tab timers), and
  // decrementing by a flat 1 per tick would silently extend the wait past
  // the provider's actual window. Deriving `secondsRemaining` from `now -
  // retryDeadline` on every tick self-corrects regardless of how late a tick
  // actually fires.
  //
  // `Date.now()` is an impure call the `react-hooks/purity` lint rule forbids
  // directly in the render body, so seeding/reseeding `retryDeadline` calls
  // it only inside a `setState` updater function (not evaluated during
  // render — lint treats it as deferred), and the per-tick recomputation
  // calls it only inside the `setTimeout` callback below (also not render).
  const [seenError, setSeenError] = useState(error);
  const [retryDeadline, setRetryDeadline] = useState<number | null>(() =>
    parsed.retryAfterSeconds != null
      ? Date.now() + parsed.retryAfterSeconds * 1000
      : null
  );
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(
    parsed.retryAfterSeconds ?? null
  );
  if (error !== seenError) {
    setSeenError(error);
    setRetryDeadline(() =>
      parsed.retryAfterSeconds != null
        ? Date.now() + parsed.retryAfterSeconds * 1000
        : null
    );
    setSecondsRemaining(parsed.retryAfterSeconds ?? null);
  }

  useEffect(() => {
    if (
      retryDeadline === null ||
      secondsRemaining === null ||
      secondsRemaining <= 0
    ) {
      return;
    }
    const timer = setTimeout(() => {
      setSecondsRemaining(
        Math.max(0, Math.ceil((retryDeadline - Date.now()) / 1000))
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [retryDeadline, secondsRemaining]);

  const isCountingDown = secondsRemaining !== null && secondsRemaining > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-destructive/20 bg-destructive/5 mx-2 mb-4 flex items-start gap-3 rounded-lg border px-4 py-3"
      role="alert"
    >
      <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-destructive text-sm font-medium">
          {titleForChatError(parsed.code)}
        </p>
        <p className="text-destructive/80 mt-0.5 text-xs">
          {describeChatError(parsed, secondsRemaining)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isCountingDown}
          className="border-destructive/20 text-destructive hover:bg-destructive/10 h-7 text-xs"
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Retry
        </Button>
        <button
          onClick={onDismiss}
          className="text-destructive/60 hover:text-destructive p-1"
          aria-label="Dismiss error"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
