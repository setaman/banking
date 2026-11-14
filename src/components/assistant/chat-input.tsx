"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { ArrowUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LENGTH = 2000;
const COUNTER_THRESHOLD = 1800;
const MAX_ROWS = 4;
// Per-row height (text-sm leading-6) plus the textarea's own vertical
// padding, used to cap the auto-grow at MAX_ROWS.
const LINE_HEIGHT_PX = 24;
const VERTICAL_PADDING_PX = 12;
const MAX_HEIGHT_PX = LINE_HEIGHT_PX * MAX_ROWS + VERTICAL_PADDING_PX;
// One row exactly, so a single line of text sits centred in the box.
const MIN_HEIGHT_PX = 36;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ChatInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly disabled: boolean;
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  function ChatInput({ value, onChange, onSend, disabled }, forwardedRef) {
    const localRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = (node: HTMLTextAreaElement | null): void => {
      localRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    // Auto-resize: 1 row minimum, capped at MAX_ROWS.
    useEffect(() => {
      const el = localRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    }, [value]);

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
      const next = event.target.value;
      onChange(next.length > MAX_LENGTH ? next.slice(0, MAX_LENGTH) : next);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (value.trim() !== "" && !disabled) {
          onSend();
        }
      }
    };

    const showCounter = value.length >= COUNTER_THRESHOLD;
    const isEmpty = value.trim() === "";

    const counter = showCounter ? (
      <span
        className={cn(
          "shrink-0 text-xs tabular-nums",
          value.length >= MAX_LENGTH
            ? "text-destructive"
            : "text-muted-foreground"
        )}
      >
        {value.length}/{MAX_LENGTH}
      </span>
    ) : null;

    const textarea = (
      <Textarea
        ref={setRefs}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your finances..."
        rows={1}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        aria-label="Message input"
        aria-describedby="chat-input-keyboard-hint"
        style={{
          minHeight: MIN_HEIGHT_PX,
          maxHeight: MAX_HEIGHT_PX,
        }}
        className={cn(
          // A bare field: the surrounding box carries border, fill and focus.
          "min-h-0 resize-none rounded-none border-0 bg-transparent px-2 py-1.5 text-sm leading-6 shadow-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm dark:bg-transparent"
        )}
      />
    );

    const sendButton = (
      <Button
        size="icon"
        onClick={onSend}
        disabled={isEmpty || disabled}
        aria-label="Send message"
        className={cn(
          "shrink-0 transition-colors",
          // Nothing to send: a quiet grey button instead of a washed-out blue.
          isEmpty &&
            !disabled &&
            "bg-muted text-muted-foreground disabled:opacity-100",
          disabled && "disabled:opacity-80",
          "rounded-xl"
        )}
      >
        {disabled ? <Loader2 className="animate-spin" /> : <ArrowUp />}
      </Button>
    );

    const hint = (
      <span id="chat-input-keyboard-hint" className="sr-only">
        Press Enter to send your message, or Shift+Enter to insert a new line.
      </span>
    );

    return (
      <div>
        <div
          className={cn(
            "border-border bg-card flex items-end gap-2 rounded-2xl border p-1.5 pl-2 shadow-sm backdrop-blur-xl transition-[border-color,box-shadow] dark:border-white/10",
            "focus-within:border-ring focus-within:ring-ring/20 focus-within:ring-[3px]"
          )}
        >
          {textarea}
          {sendButton}
        </div>
        {hint}
        <div className="mt-2 flex items-center justify-center gap-2 px-1">
          <p className="text-muted-foreground text-center text-xs">
            Answers are AI-generated and may be inaccurate. Verify important
            figures.
          </p>
          {counter}
        </div>
      </div>
    );
  }
);
