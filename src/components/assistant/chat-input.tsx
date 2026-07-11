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
// Approximate per-row height (text-sm leading-relaxed) plus vertical padding,
// used to cap the textarea's auto-grow at MAX_ROWS.
const LINE_HEIGHT_PX = 20;
const VERTICAL_PADDING_PX = 20;
const MAX_HEIGHT_PX = LINE_HEIGHT_PX * MAX_ROWS + VERTICAL_PADDING_PX;
const MIN_HEIGHT_PX = 44;

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

    return (
      <div>
        <div className="relative">
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
            style={{
              minHeight: MIN_HEIGHT_PX,
              maxHeight: MAX_HEIGHT_PX,
            }}
            className="border-border bg-card focus-visible:border-primary/40 resize-none rounded-xl pr-12 text-sm focus-visible:ring-0"
          />
          <Button
            size="icon"
            onClick={onSend}
            disabled={value.trim() === "" || disabled}
            aria-label="Send message"
            className={cn(
              "absolute right-2 bottom-2 h-8 w-8 rounded-lg",
              "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            )}
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <p className="text-muted-foreground text-center text-[11px]">
            Answers are AI-generated and may be inaccurate. Verify important
            figures.
          </p>
          {showCounter && (
            <span
              className={cn(
                "shrink-0 text-[11px] tabular-nums",
                value.length >= MAX_LENGTH
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {value.length}/{MAX_LENGTH}
            </span>
          )}
        </div>
      </div>
    );
  }
);
