"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { motion } from "motion/react";
import { BotMessageSquare, Loader2, Sparkles, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { getAiConfigStatus } from "@/actions/ai.actions";
import { getTransactionCount } from "@/actions/transactions.actions";

import {
  ChatMessageBubble,
  getToolDisplayLabel,
  type ChatMessageData,
  type ToolActivity,
} from "@/components/assistant/chat-message";
import { ChatInput } from "@/components/assistant/chat-input";
import { ChatErrorBanner } from "@/components/assistant/chat-error-banner";
import { StarterChips } from "@/components/assistant/starter-chips";
import {
  AiNotConfiguredState,
  NoTransactionDataState,
} from "@/components/assistant/empty-states";
import { useChatPersistence } from "@/hooks/use-chat-persistence";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Joins every `text` part of a UI message into a single Markdown string. */
function extractText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

function isUserOrAssistant(
  message: UIMessage
): message is UIMessage & { role: "user" | "assistant" } {
  return message.role === "user" || message.role === "assistant";
}

function deriveToolStatus(state: string): ToolActivity["status"] {
  if (state === "output-available") return "complete";
  if (state === "output-error") return "error";
  return "running";
}

type PageStatus = "loading" | "not-configured" | "no-data" | "ready";

const THINKING_MESSAGE: ChatMessageData = {
  id: "__thinking__",
  role: "assistant",
  content: "",
  timestamp: new Date(0).toISOString(),
  isStreaming: true,
  toolActivities: [],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AssistantPage(): React.JSX.Element {
  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [modelName, setModelName] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  // Tracks the specific error instance the user dismissed, so a *new* error
  // (a different object reference) is shown again even if a previous one
  // was dismissed. Derived during render instead of via an effect + setState.
  const [dismissedError, setDismissedError] = useState<Error | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const {
    initialMessages,
    persist,
    getTimestamp,
    clear: clearPersisted,
  } = useChatPersistence();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages: messages.filter(isUserOrAssistant).map((m) => ({
              role: m.role,
              content: extractText(m),
            })),
          },
        }),
      }),
    []
  );

  const {
    messages,
    sendMessage,
    status,
    error,
    regenerate,
    setMessages,
    clearError,
  } = useChat({
    messages: initialMessages,
    transport,
  });

  const isBusy = status === "streaming" || status === "submitted";

  // ---------------------------------------------------------------------------
  // Load AI config status + transaction count once on mount to decide the
  // blocking-state priority: not-configured -> no-data -> welcome/conversation.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [aiStatus, txCount] = await Promise.all([
          getAiConfigStatus(),
          getTransactionCount(undefined, { excludeInternal: true }),
        ]);
        if (cancelled) return;

        if (!aiStatus.configured) {
          setPageStatus("not-configured");
          return;
        }
        setModelName(aiStatus.model ?? null);

        if (txCount === 0) {
          setPageStatus("no-data");
          return;
        }
        setPageStatus("ready");
      } catch (err) {
        console.error("Failed to load assistant page context:", err);
        if (!cancelled) setPageStatus("not-configured");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Focus the input once the conversation surface becomes available.
  useEffect(() => {
    if (pageStatus === "ready") {
      inputRef.current?.focus();
    }
  }, [pageStatus]);

  // Persist the conversation once it settles (skip mid-stream to avoid
  // writing partial tokens and excessive localStorage churn).
  useEffect(() => {
    if (isBusy) return;
    persist(messages);
  }, [messages, isBusy, persist]);

  // ---------------------------------------------------------------------------
  // Derived display data
  // ---------------------------------------------------------------------------

  const chatMessages: ChatMessageData[] = useMemo(() => {
    const filtered = messages.filter(isUserOrAssistant);
    return filtered.map((m, index) => {
      const isLast = index === filtered.length - 1;
      const isStreaming =
        m.role === "assistant" && isLast && status === "streaming";
      const toolActivities: ToolActivity[] = m.parts
        .filter(isToolUIPart)
        .map((part) => ({
          toolCallId: part.toolCallId,
          toolName: getToolName(part),
          displayLabel: getToolDisplayLabel(getToolName(part)),
          status: deriveToolStatus(part.state),
        }));
      const interrupted =
        m.role === "assistant" && isLast && Boolean(error) && !isStreaming;

      return {
        id: m.id,
        role: m.role,
        content: extractText(m),
        timestamp: getTimestamp(m.id),
        isStreaming,
        toolActivities,
        interrupted,
      };
    });
  }, [messages, status, error, getTimestamp]);

  const showThinkingBubble =
    status === "submitted" &&
    (chatMessages.length === 0 ||
      chatMessages[chatMessages.length - 1]?.role === "user");

  // Auto-scroll to the bottom on new content, unless the user has scrolled up.
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, showThinkingBubble]);

  const handleScroll = useCallback((): void => {
    const el = scrollContainerRef.current;
    if (!el) return;
    shouldAutoScrollRef.current =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 100;
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSend = useCallback((): void => {
    const trimmed = input.trim();
    if (trimmed === "" || isBusy) return;
    shouldAutoScrollRef.current = true;
    void sendMessage({ text: trimmed });
    setInput("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [input, isBusy, sendMessage]);

  const handleStarterClick = useCallback(
    (prompt: string): void => {
      if (isBusy) return;
      shouldAutoScrollRef.current = true;
      void sendMessage({ text: prompt });
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [isBusy, sendMessage]
  );

  const handleClearConfirm = useCallback((): void => {
    setMessages([]);
    clearPersisted();
    setClearDialogOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [setMessages, clearPersisted]);

  const handleRetry = useCallback((): void => {
    clearError();
    void regenerate();
  }, [clearError, regenerate]);

  const handleDismissError = useCallback((): void => {
    setDismissedError(error ?? null);
  }, [error]);

  // The error banner shows the current error unless the user already
  // dismissed this exact error instance (a later, distinct error re-shows it).
  const displayedError = error && error !== dismissedError ? error : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="flex min-h-[calc(100dvh-8rem)] flex-col"
      style={{ height: "calc(100vh - 8rem - 3.5rem)" }}
    >
      {/* Header row */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="border-border flex items-center justify-between border-b px-2 py-3"
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
            <BotMessageSquare className="text-primary h-4 w-4" />
          </div>
          <h2 className="text-foreground text-lg font-semibold">
            AI Assistant
          </h2>
          <Badge
            variant="secondary"
            className="hidden font-mono text-[11px] md:inline-flex"
          >
            {modelName ?? "Not configured"}
          </Badge>
        </div>

        <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={chatMessages.length === 0}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear this conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearConfirm}>
                Clear
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>

      {/* Body */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="flex flex-1 flex-col overflow-hidden"
      >
        {pageStatus === "loading" && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        )}

        {pageStatus === "not-configured" && <AiNotConfiguredState />}
        {pageStatus === "no-data" && <NoTransactionDataState />}

        {pageStatus === "ready" &&
          chatMessages.length === 0 &&
          !showThinkingBubble && (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-primary/10 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
              >
                <Sparkles className="text-primary h-8 w-8" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 }}
                className="text-foreground mb-2 text-center text-xl font-semibold"
              >
                What would you like to know?
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2 }}
                className="text-muted-foreground mb-8 max-w-md text-center text-sm"
              >
                Ask me anything about your finances. I can analyze transactions,
                spot trends, and show you charts.
              </motion.p>
              <StarterChips onSelect={handleStarterClick} />
            </div>
          )}

        {pageStatus === "ready" &&
          (chatMessages.length > 0 || showThinkingBubble) && (
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              role="log"
              aria-live="polite"
              aria-label="Chat messages"
              aria-relevant="additions"
              className="flex-1 space-y-6 overflow-y-auto px-2 py-6 sm:px-4"
            >
              {displayedError && (
                <ChatErrorBanner
                  error={displayedError}
                  onRetry={handleRetry}
                  onDismiss={handleDismissError}
                />
              )}
              {chatMessages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} />
              ))}
              {showThinkingBubble && (
                <ChatMessageBubble
                  key={THINKING_MESSAGE.id}
                  message={THINKING_MESSAGE}
                />
              )}
              <div ref={scrollAnchorRef} />
            </div>
          )}
      </motion.div>

      {/* Pinned input bar */}
      {pageStatus === "ready" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="border-border bg-background/80 sticky bottom-0 border-t px-2 py-3 backdrop-blur-xl sm:px-4"
        >
          <ChatInput
            ref={inputRef}
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={isBusy}
          />
        </motion.div>
      )}
    </div>
  );
}
