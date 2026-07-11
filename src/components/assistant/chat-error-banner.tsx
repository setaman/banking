"use client";

import { motion } from "motion/react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Error code mapping (docs/design/ai-assistant-ui.md §7)
//
// The `/api/chat` route returns a JSON body `{ error: <code> }` with a
// non-2xx status on failure. The AI SDK's `HttpChatTransport` throws
// `new Error(await response.text())`, so `error.message` is that raw JSON
// text (or a generic fetch-failure string for actual network errors). This
// module recovers the code from that message and maps it to a friendly,
// actionable message.
// ---------------------------------------------------------------------------

export type ChatErrorCode =
  | "not_configured"
  | "auth"
  | "rate_limit"
  | "rate_limit_local"
  | "ollama_unreachable"
  | "provider_error"
  | "invalid_request"
  | "network";

const ERROR_MESSAGES: Record<ChatErrorCode, string> = {
  not_configured:
    "The AI assistant isn't configured yet. Add a provider and API key in Settings.",
  auth: "Authentication failed. Check that your API key in Settings is correct and active.",
  rate_limit:
    "Rate limited by the AI provider. Please wait a moment and try again.",
  rate_limit_local:
    "You're sending messages too quickly. Please wait a minute and try again.",
  ollama_unreachable:
    "Could not reach your local Ollama server. Make sure it's running and the model is pulled.",
  provider_error: "The AI provider returned an error. Please try again.",
  invalid_request: "That message couldn't be processed. Try rephrasing it.",
  network: "Could not reach the server. Check your connection and try again.",
};

const KNOWN_CODES = new Set<string>(Object.keys(ERROR_MESSAGES));

/** Extracts a known error code from a route/network error, defaulting to "network". */
export function classifyChatError(error: Error): ChatErrorCode {
  try {
    const parsed: unknown = JSON.parse(error.message);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { error?: unknown }).error === "string" &&
      KNOWN_CODES.has((parsed as { error: string }).error)
    ) {
      return (parsed as { error: ChatErrorCode }).error;
    }
  } catch {
    // Not a JSON error body — fall through to a network-error default.
  }
  return "network";
}

/** Returns a friendly, user-facing message for a chat error. */
export function describeChatError(error: Error): string {
  return ERROR_MESSAGES[classifyChatError(error)];
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
          Failed to get a response
        </p>
        <p className="text-destructive/80 mt-0.5 text-xs">
          {describeChatError(error)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
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
