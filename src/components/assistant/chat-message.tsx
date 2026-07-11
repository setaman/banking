"use client";

import { Component, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { motion } from "motion/react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";

import { parseVisualizationSpec } from "@/lib/ai/visualization";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Public types
//
// NOTE: `docs/design/ai-assistant-ui.md` §4 specifies a `ToolActivity` shape
// keyed by a fixed table of 6 illustrative tool names (`query_transactions`,
// `calculate_stats`, ...). The actual finance tool barrel
// (`src/lib/ai/tools/index.ts`, built in Phase B) exports 15 differently
// named tools (`get_accounts`, `get_monthly_cash_flow`, ...). `TOOL_LABELS`
// below is built against the real tool names, following the same
// "actual code over stale doc" precedent already flagged in Phase C's
// `visualization.ts` deviation.
// ---------------------------------------------------------------------------

export interface ToolActivity {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly displayLabel: string;
  readonly status: "running" | "complete" | "error";
}

export interface ChatMessageData {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly timestamp: string;
  readonly isStreaming: boolean;
  readonly toolActivities: readonly ToolActivity[];
  /** True when the response was cut off by an error before it finished. */
  readonly interrupted?: boolean;
}

// ---------------------------------------------------------------------------
// Tool display-label mapping
// ---------------------------------------------------------------------------

const TOOL_LABELS: Record<string, string> = {
  get_accounts: "Checking your accounts…",
  get_total_balance: "Checking your balances…",
  get_monthly_cash_flow: "Reviewing monthly cash flow…",
  get_category_breakdown: "Analyzing categories…",
  get_budget_split: "Splitting needs vs. wants…",
  get_savings_rate: "Calculating your savings rate…",
  get_recurring_expenses: "Looking at recurring payments…",
  get_expense_volatility: "Measuring spending volatility…",
  get_income_stability: "Checking income stability…",
  get_emergency_fund: "Sizing your emergency fund…",
  get_balance_prediction: "Projecting your future balance…",
  search_transactions: "Searching your transactions…",
  compare_periods: "Comparing time periods…",
  get_largest_expenses: "Finding your largest expenses…",
  get_spending_patterns: "Analyzing spending patterns…",
};

export function getToolDisplayLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? "Analyzing your data…";
}

// ---------------------------------------------------------------------------
// Content segmentation — split assistant Markdown on fenced ```visualization
// blocks. Text segments render via the markdown-lite renderer; visualization
// segments render a neutral placeholder in this phase (full chart rendering
// is Phase E — swap `VisualizationPlaceholder` there).
// ---------------------------------------------------------------------------

interface TextSegment {
  readonly type: "text";
  readonly text: string;
}
interface VisualizationSegment {
  readonly type: "visualization";
  readonly raw: string;
}
type ContentSegment = TextSegment | VisualizationSegment;

function splitContent(content: string): ContentSegment[] {
  const regex = /```visualization\s*\n([\s\S]*?)```/g;
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        text: content.slice(lastIndex, match.index),
      });
    }
    segments.push({ type: "visualization", raw: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", text: content.slice(lastIndex) });
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Markdown-lite renderer — bold, italic, inline code, bullet/numbered lists,
// and tabular-nums currency highlighting. No headings (by design — assistant
// speaks in flowing prose, not document structure).
// ---------------------------------------------------------------------------

const CURRENCY_REGEX = /(-?[\d.,]*\d\s?(?:€|EUR))/g;

function renderCurrency(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  const regex = new RegExp(CURRENCY_REGEX.source, "g");

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <span key={`${keyPrefix}-m${i++}`} className="font-medium tabular-nums">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        ...renderCurrency(
          text.slice(lastIndex, match.index),
          `${keyPrefix}-t${i++}`
        )
      );
    }
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b${i++}`}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${i++}`}
          className="bg-muted/50 rounded px-1 py-0.5 font-mono text-[13px]"
        >
          {match[4]}
        </code>
      );
    } else if (match[5] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i${i++}`}>{match[6]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(
      ...renderCurrency(text.slice(lastIndex), `${keyPrefix}-t${i++}`)
    );
  }
  return nodes;
}

const BULLET_LINE_RE = /^[-*]\s+(.*)$/;
const NUMBERED_LINE_RE = /^\d+\.\s+(.*)$/;

function MarkdownLite({ text }: { text: string }): React.JSX.Element {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    const bulletMatch = BULLET_LINE_RE.exec(trimmed);
    if (bulletMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = BULLET_LINE_RE.exec(lines[i].trim());
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      const key = blockKey++;
      blocks.push(
        <ul key={`b${key}`} className="my-1.5 list-disc space-y-0.5 pl-5">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `b${key}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    const numberedMatch = NUMBERED_LINE_RE.exec(trimmed);
    if (numberedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = NUMBERED_LINE_RE.exec(lines[i].trim());
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      const key = blockKey++;
      blocks.push(
        <ol key={`b${key}`} className="my-1.5 list-decimal space-y-0.5 pl-5">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `b${key}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const key = blockKey++;
    blocks.push(
      <p key={`b${key}`} className="[&:not(:first-child)]:mt-2">
        {renderInline(lines[i], `b${key}`)}
      </p>
    );
    i++;
  }

  return <>{blocks}</>;
}

// ---------------------------------------------------------------------------
// Inline visualization — Phase D renders a neutral placeholder only; Phase E
// swaps `VisualizationPlaceholderContent`'s body for the real ECharts/table
// renderer. Wrapped in an error boundary per the design spec's "never crash
// the message list because of a malformed chart spec" rule.
// ---------------------------------------------------------------------------

function VisualizationFallback(): React.JSX.Element {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>Could not render this visualization.</span>
    </div>
  );
}

function VisualizationPlaceholderContent({
  raw,
}: {
  raw: string;
}): React.JSX.Element {
  const spec = parseVisualizationSpec(raw.trim());
  if (!spec) {
    return <VisualizationFallback />;
  }
  return (
    <div className="border-border bg-muted/30 dark:bg-card/40 mt-3 flex flex-col items-center justify-center gap-1.5 rounded-xl border px-4 py-6 text-center">
      <BarChart3 className="text-muted-foreground h-5 w-5" />
      <p className="text-muted-foreground text-xs font-medium">
        Chart will render here
      </p>
      <p className="text-muted-foreground/70 font-mono text-[11px] uppercase">
        {spec.type}
        {spec.title ? ` · ${spec.title}` : ""}
      </p>
    </div>
  );
}

interface VisualizationErrorBoundaryState {
  readonly hasError: boolean;
}

class VisualizationErrorBoundary extends Component<
  { children: ReactNode },
  VisualizationErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): VisualizationErrorBoundaryState {
    return { hasError: true };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <VisualizationFallback />;
    }
    return this.props.children;
  }
}

function VisualizationPlaceholder({ raw }: { raw: string }): React.JSX.Element {
  return (
    <VisualizationErrorBoundary>
      <VisualizationPlaceholderContent raw={raw} />
    </VisualizationErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    return format(parseISO(iso), "HH:mm");
  } catch {
    return "";
  }
}

function CopyButton({ content }: { content: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable or permission denied — fail silently.
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
      aria-label="Copy message"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function ToolActivityIndicator({
  activity,
}: {
  activity: ToolActivity;
}): React.JSX.Element {
  return (
    <div
      className="text-muted-foreground mb-2 flex items-center gap-2 text-xs"
      aria-live="polite"
    >
      {activity.status === "running" ? (
        <Loader2 className="text-primary h-3 w-3 animate-spin" />
      ) : activity.status === "complete" ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      ) : (
        <XCircle className="text-destructive h-3 w-3" />
      )}
      <span className="italic">{activity.displayLabel}</span>
      <span className="text-muted-foreground/60 font-mono text-[10px]">
        {activity.toolName}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bubbles
// ---------------------------------------------------------------------------

function UserBubble({
  message,
}: {
  message: ChatMessageData;
}): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex justify-end"
      role="article"
      aria-label="User message"
    >
      <div className="max-w-[85%] sm:max-w-[75%] md:max-w-[65%]">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
        <p className="text-muted-foreground mt-1 text-right text-[10px] tabular-nums">
          {formatTimestamp(message.timestamp)}
        </p>
      </div>
    </motion.div>
  );
}

function AssistantBubble({
  message,
}: {
  message: ChatMessageData;
}): React.JSX.Element {
  const segments = splitContent(message.content);
  const hasText = message.content.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex gap-3"
      role="article"
      aria-label="Assistant message"
      aria-busy={message.isStreaming}
    >
      <div className="bg-primary/10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
        <Sparkles className="text-primary h-3.5 w-3.5" />
      </div>

      <div className="max-w-[85%] min-w-0 sm:max-w-[80%] md:max-w-[75%]">
        {message.toolActivities.map((activity) => (
          <ToolActivityIndicator
            key={activity.toolCallId}
            activity={activity}
          />
        ))}

        <div
          className={cn(
            "border-border bg-card text-card-foreground dark:bg-card/80 rounded-2xl rounded-tl-md border px-4 py-3 text-sm leading-relaxed backdrop-blur-xl"
          )}
        >
          {hasText ? (
            <>
              {segments.map((segment, index) =>
                segment.type === "text" ? (
                  <MarkdownLite key={index} text={segment.text} />
                ) : (
                  <VisualizationPlaceholder key={index} raw={segment.raw} />
                )
              )}
              {message.isStreaming && (
                <span className="bg-primary ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-full align-middle" />
              )}
            </>
          ) : message.isStreaming ? (
            <div className="flex items-center gap-1 py-0.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-muted-foreground/50 h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          ) : null}
        </div>

        {message.interrupted && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-500">
            <AlertTriangle className="h-3 w-3" />
            <span className="italic">Response was interrupted</span>
          </div>
        )}

        {hasText && (
          <div className="mt-1 flex items-center gap-2">
            <p className="text-muted-foreground text-[10px] tabular-nums">
              {formatTimestamp(message.timestamp)}
            </p>
            <CopyButton content={message.content} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ChatMessageBubble({
  message,
}: {
  message: ChatMessageData;
}): React.JSX.Element {
  return message.role === "user" ? (
    <UserBubble message={message} />
  ) : (
    <AssistantBubble message={message} />
  );
}
