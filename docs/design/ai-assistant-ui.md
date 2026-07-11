# AI Assistant -- UI/UX Design Specification

**Feature:** Conversational AI financial analyst for BanKing
**Author:** Design Agent (designer-high)
**Date:** 2026-07-11
**Status:** Ready for implementation

---

## Table of Contents

1. [Design Decisions](#1-design-decisions)
2. [Navigation Integration](#2-navigation-integration)
3. [Page Layout -- `/assistant`](#3-page-layout----assistant)
4. [Message Design](#4-message-design)
5. [Inline Visualizations](#5-inline-visualizations)
6. [Welcome & Empty States](#6-welcome--empty-states)
7. [Error States](#7-error-states)
8. [Settings Card -- "AI Assistant"](#8-settings-card----ai-assistant)
9. [Motion & Entrance Animations](#9-motion--entrance-animations)
10. [Accessibility](#10-accessibility)
11. [Component Inventory & Tailwind Tokens](#11-component-inventory--tailwind-tokens)

---

## 1. Design Decisions

### Aesthetic Direction

**Tone: Conversational Glass** -- the assistant page is a full-height immersive conversation surface that inherits the Neo-Glass language (translucent cards, backdrop blur, OKLCH palette) but strips away the dashboard's grid density in favor of a single-column reading rhythm. The page should feel like a private briefing room, not a crowded control panel.

### Key Differentiator

The inline visualization system: assistant messages can seamlessly embed ECharts/shadcn stat cards directly inside the conversation flow, making this feel like a living document rather than a chatbot pasted onto a dashboard. Charts inherit the exact same theme-aware color palette already used across Dashboard, Insights, and Sandbox so they read as native, not foreign.

### Critical Light-Mode Constraint

Every surface in this spec uses **`border-border`** (the theme token) rather than `border-white/10` or `border-white/5`. The Card component's base class still ships with `border-white/10`; any Card used on this page must override it with `className="border-border"` (or the double token `border-border dark:border-white/10` where the dark-mode glow is desired). This is the same fix applied to the Sandbox page (see `docs/PROJECT-STATE.md`, Bug 4). Failure to do this makes cards invisible in light mode.

---

## 2. Navigation Integration

### Nav Link Placement

Insert `"Assistant"` between `"Sandbox"` and `"Settings"` in `src/components/layout/nav.tsx`:

```
Dashboard | Insights | Transactions | Sandbox | Assistant | Settings
```

Implementation: add `{ href: "/assistant", label: "Assistant" }` at index 4 (before the Settings entry) in the `links` array.

### Route

- Path: `/assistant`
- File: `src/app/(dashboard)/assistant/page.tsx`
- Directive: `"use client"` (streaming state, localStorage, user input are all browser-only)

---

## 3. Page Layout -- `/assistant`

### Structural Concept

The assistant page is a **full-available-height chat column** that lives inside the existing `max-w-7xl` layout container. Unlike Dashboard/Insights which scroll freely, this page pins an input bar to the bottom of the viewport and makes only the message list scroll.

### Desktop Layout (md and above)

```
+----------------------------------------------------------+
|  HEADER ROW  (sticky within column, not viewport)        |
|  [Bot icon] AI Assistant    [model badge]   [Clear btn]  |
+----------------------------------------------------------+
|                                                          |
|  SCROLLABLE MESSAGE LIST                                 |
|  (flex-1 overflow-y-auto)                                |
|                                                          |
|  ... user bubble right-aligned ...                       |
|  ... assistant bubble left-aligned ...                   |
|  ... inline chart inside assistant bubble ...            |
|  ... tool-activity indicator ...                         |
|                                                          |
|  (auto-scroll anchor div at bottom)                      |
+----------------------------------------------------------+
|  PINNED INPUT BAR                                        |
|  [textarea]                              [Send button]   |
|  "Ask about your finances..."                            |
+----------------------------------------------------------+
```

### Mobile Layout (below md)

Identical single-column structure. The input bar sticks to the bottom of the viewport via `sticky bottom-0`. Message bubbles span full width (no max-width constraint on mobile). The header row collapses: model badge hides, Clear button becomes an icon-only button.

### Outer Container

```
className="flex flex-col"
style={{ height: "calc(100vh - 8rem - 3.5rem)" }}
```

The `8rem` accounts for the fixed header offset (`pt-32` = 8rem from `layout.tsx`), and `3.5rem` reserves breathing room for the footer. On mobile, use `height: calc(100dvh - 8rem)` via a `min-h-[calc(100dvh-8rem)]` fallback to handle mobile browser chrome.

### Header Row

```tsx
<div className="flex items-center justify-between border-b border-border px-2 py-3">
  {/* Left cluster */}
  <div className="flex items-center gap-3">
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
      <BotMessageSquare className="h-4 w-4 text-primary" />
    </div>
    <h1 className="text-lg font-semibold text-foreground">
      AI Assistant
    </h1>
    {/* Model badge -- desktop only */}
    <Badge
      variant="secondary"
      className="hidden text-[11px] font-mono md:inline-flex"
    >
      {modelName}
    </Badge>
  </div>

  {/* Right cluster */}
  <Button
    variant="ghost"
    size="sm"
    onClick={handleClear}
    className="text-muted-foreground hover:text-destructive"
    disabled={messages.length === 0}
  >
    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
    <span className="hidden sm:inline">Clear</span>
  </Button>
</div>
```

- `BotMessageSquare` from lucide-react for the icon.
- `modelName` is derived from the AI config in localStorage/settings (e.g., `"gpt-4o"`, `"claude-sonnet-4"`, `"gemini-2.5-pro"`). Shows `"Not configured"` with a muted style if no model is set.
- The Clear button triggers an `AlertDialog` confirmation: "Clear this conversation? This cannot be undone."

### Scrollable Message List

```tsx
<div
  ref={scrollContainerRef}
  className="flex-1 space-y-6 overflow-y-auto px-2 py-6 sm:px-4"
>
  {messages.map(msg => <MessageBubble key={msg.id} ... />)}
  <div ref={scrollAnchorRef} />
</div>
```

- `space-y-6` between messages (24px vertical gap).
- Auto-scroll: on new message or streaming token, `scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" })`. Disable auto-scroll if the user has manually scrolled up (detect via `scrollTop + clientHeight < scrollHeight - 100`).

### Pinned Input Bar

```tsx
<div className="sticky bottom-0 border-t border-border bg-background/80 px-2 py-3 backdrop-blur-xl sm:px-4">
  <div className="relative">
    <Textarea
      ref={inputRef}
      value={input}
      onChange={e => setInput(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Ask about your finances..."
      rows={1}
      className="min-h-[44px] max-h-[160px] resize-none pr-12 text-sm
                 bg-card border-border focus:border-primary/40
                 rounded-xl"
      disabled={isStreaming}
      aria-label="Message input"
    />
    <Button
      size="icon"
      onClick={handleSend}
      disabled={input.trim() === "" || isStreaming}
      className="absolute right-2 bottom-2 h-8 w-8 rounded-lg
                 bg-primary text-primary-foreground
                 hover:bg-primary/90 disabled:opacity-40"
      aria-label="Send message"
    >
      {isStreaming ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ArrowUp className="h-4 w-4" />
      )}
    </Button>
  </div>
  <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
    Answers are AI-generated and may be inaccurate. Verify important figures.
  </p>
</div>
```

- Textarea auto-grows up to `max-h-[160px]` (about 6 lines).
- Send on **Enter** (without Shift). **Shift+Enter** inserts a newline.
- While streaming, the Send button shows `Loader2` spinner and is disabled. A second click during streaming could optionally abort (stretch goal).
- The disclaimer text is always visible below the input.

---

## 4. Message Design

### Message Data Model

```typescript
interface ChatMessage {
  readonly id: string;              // crypto.randomUUID()
  readonly role: "user" | "assistant";
  readonly content: string;         // Markdown text
  readonly timestamp: string;       // ISO 8601
  readonly visualizations?: VisualizationSpec[];  // Inline charts/tables
  readonly isStreaming?: boolean;    // True while tokens are arriving
  readonly toolActivity?: ToolActivity | null;
}

interface ToolActivity {
  readonly toolName: string;        // e.g., "query_transactions", "calculate_stats"
  readonly displayLabel: string;    // e.g., "Analyzing your spending data"
  readonly status: "running" | "complete" | "error";
}
```

### User Message Bubble

```tsx
<div className="flex justify-end">
  <div className="max-w-[85%] sm:max-w-[75%] md:max-w-[65%]">
    <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5
                    text-sm text-primary-foreground leading-relaxed">
      {message.content}
    </div>
    <p className="mt-1 text-right text-[10px] text-muted-foreground tabular-nums">
      {formatTime(message.timestamp)}
    </p>
  </div>
</div>
```

- Right-aligned, primary-colored solid bubble with a flattened bottom-right corner (`rounded-br-md`).
- Max-width caps at 65% on desktop to maintain a conversational column feel.
- Timestamp below in 10px muted text, right-aligned, using `tabular-nums` for monospaced digits.
- Time format: `HH:mm` (24-hour, German convention), via `date-fns format(parseISO(ts), "HH:mm")`.

### Assistant Message Bubble

```tsx
<div className="flex gap-3">
  {/* Avatar */}
  <div className="flex h-7 w-7 shrink-0 items-center justify-center
                  rounded-lg bg-primary/10 mt-0.5">
    <Sparkles className="h-3.5 w-3.5 text-primary" />
  </div>

  {/* Content column */}
  <div className="max-w-[85%] sm:max-w-[80%] md:max-w-[75%] min-w-0">
    {/* Tool activity indicator (shown above text while tool is running) */}
    {message.toolActivity && (
      <ToolActivityIndicator activity={message.toolActivity} />
    )}

    {/* Text body */}
    <div className="rounded-2xl rounded-tl-md border border-border
                    bg-card px-4 py-3 text-sm leading-relaxed
                    text-card-foreground backdrop-blur-xl
                    dark:bg-card/80">
      <MarkdownRenderer content={message.content} />

      {/* Inline visualizations */}
      {message.visualizations?.map((viz, i) => (
        <InlineVisualization key={i} spec={viz} />
      ))}
    </div>

    {/* Footer row: timestamp + copy */}
    <div className="mt-1 flex items-center gap-2">
      <p className="text-[10px] text-muted-foreground tabular-nums">
        {formatTime(message.timestamp)}
      </p>
      <button
        onClick={() => copyToClipboard(message.content)}
        className="text-muted-foreground hover:text-foreground
                   rounded p-0.5 transition-colors"
        aria-label="Copy message"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  </div>
</div>
```

- Left-aligned, with a small `Sparkles` icon avatar in a `bg-primary/10` rounded square.
- Glass-card styling: `bg-card border-border backdrop-blur-xl dark:bg-card/80`. The `dark:bg-card/80` preserves translucency in dark mode while keeping the card opaque enough in light mode (same fix pattern as Sandbox Bug 4).
- Flattened top-left corner (`rounded-tl-md`) to visually "point" toward the avatar.
- Copy button on assistant messages only, appearing as a subtle icon to the right of the timestamp.
- Copy action: copies raw Markdown text to clipboard, shows `Check` icon for 2 seconds after copy, then reverts to `Copy` icon.

### Markdown Renderer

The `MarkdownRenderer` component renders assistant text as rich Markdown. Use a lightweight renderer (e.g., `react-markdown` with `remark-gfm`) or a simple custom parser for the subset needed:

- **Bold** and *italic* text
- Inline `code` with `font-mono text-[13px] bg-muted/50 px-1 py-0.5 rounded` styling
- Bullet and numbered lists
- Currency values: render amounts matching `EUR` or euro patterns in `tabular-nums font-medium` so numbers align cleanly

Do NOT render headings (h1-h6) inside bubbles -- the assistant should speak in flowing prose, not document structure.

### Streaming / Typing Indicator

While `message.isStreaming === true`, append a blinking cursor after the last token:

```tsx
{message.isStreaming && (
  <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse
                   rounded-full bg-primary align-middle" />
)}
```

This is a thin 2px-wide primary-colored bar that pulses, positioned inline at the end of the streamed text. It disappears when streaming completes.

If no text has arrived yet (streaming just started), show three pulsing dots instead:

```tsx
<div className="flex items-center gap-1 px-4 py-3">
  {[0, 1, 2].map(i => (
    <div
      key={i}
      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse"
      style={{ animationDelay: `${i * 150}ms` }}
    />
  ))}
</div>
```

### Tool Activity Indicator

When the assistant invokes a tool (e.g., querying transaction data), show an activity indicator above the message text:

```tsx
function ToolActivityIndicator({ activity }: { activity: ToolActivity }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
      {activity.status === "running" ? (
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
      ) : activity.status === "complete" ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      ) : (
        <XCircle className="h-3 w-3 text-destructive" />
      )}
      <span className="italic">{activity.displayLabel}</span>
      <span className="font-mono text-[10px] text-muted-foreground/60">
        {activity.toolName}
      </span>
    </div>
  );
}
```

- Running state: spinner + "Analyzing your spending data..." + tool name in tiny mono.
- Complete state: green check (flashes in, then stays).
- Error state: red X.
- Multiple tool calls in sequence stack vertically, each with its own indicator.

Tool display labels (map from tool names):

| Tool Name              | Display Label                       |
| ---------------------- | ----------------------------------- |
| `query_transactions`   | "Searching your transactions..."    |
| `calculate_stats`      | "Crunching the numbers..."          |
| `get_balances`         | "Checking your balances..."         |
| `get_categories`       | "Analyzing categories..."           |
| `get_recurring`        | "Looking at recurring payments..."  |
| `get_monthly_flow`     | "Reviewing monthly cash flow..."    |

---

## 5. Inline Visualizations

### Visualization Spec Model

The assistant can embed visualizations inside its messages. The spec is a constrained JSON structure that the frontend interprets into ECharts or shadcn components. The assistant's response includes these specs alongside the Markdown text.

```typescript
type VisualizationSpec =
  | BarChartSpec
  | LineChartSpec
  | PieChartSpec
  | StatCardSpec
  | TableSpec;

interface BarChartSpec {
  readonly type: "bar";
  readonly title?: string;
  readonly data: readonly { label: string; value: number }[];
  readonly xLabel?: string;
  readonly yLabel?: string;
  readonly color?: "income" | "expense" | "primary" | "mixed";
}

interface LineChartSpec {
  readonly type: "line";
  readonly title?: string;
  readonly data: readonly { label: string; value: number }[];
  readonly xLabel?: string;
  readonly yLabel?: string;
  readonly smooth?: boolean;
}

interface PieChartSpec {
  readonly type: "pie";
  readonly title?: string;
  readonly data: readonly { label: string; value: number }[];
  readonly donut?: boolean;  // defaults true
}

interface StatCardSpec {
  readonly type: "stat";
  readonly label: string;
  readonly value: string;           // Pre-formatted (e.g., "1.234,56 EUR")
  readonly trend?: "up" | "down" | "neutral";
  readonly trendValue?: string;     // e.g., "+12.3%"
  readonly description?: string;
}

interface TableSpec {
  readonly type: "table";
  readonly title?: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}
```

### Presentation Rules

All inline visualizations render inside the assistant bubble, below the text content, separated by a `border-t border-border mt-3 pt-3` divider.

#### Chart Container (Bar, Line, Pie)

```tsx
<div className="mt-3 border-t border-border pt-3">
  {viz.title && (
    <p className="mb-2 text-xs font-medium text-muted-foreground">
      {viz.title}
    </p>
  )}
  <div className="h-[200px] min-h-[160px] max-h-[280px] w-full">
    <ReactECharts
      option={buildChartOption(viz, isDark)}
      style={{ height: "100%", width: "100%" }}
      opts={{ renderer: "svg" }}
      notMerge
      lazyUpdate
    />
  </div>
  <ViewDataToggle data={viz.data} columns={...} />
</div>
```

- **Height**: Fixed at `200px` with `min-h-[160px]` and `max-h-[280px]`. Charts should not dominate the conversation.
- **Renderer**: Use SVG renderer (`opts={{ renderer: "svg" }}`) for crisper rendering at small sizes.
- **Theme awareness**: All chart options use the same `isDark` conditional color pattern as `income-expenses-chart.tsx` and `category-breakdown-chart.tsx`. Text color, grid color, and series colors are derived from `resolvedTheme`.

#### Chart Color Palette

Reuse the exact same palette from `category-breakdown-chart.tsx`:

```typescript
// Dark mode
const CHART_COLORS_DARK = [
  "rgb(139, 92, 246)",   // chart-1: Violet
  "rgb(217, 70, 239)",   // chart-2: Magenta
  "rgb(20, 184, 166)",   // chart-3: Teal
  "rgb(251, 146, 60)",   // chart-4: Orange
  "rgb(244, 114, 182)",  // chart-5: Pink
  "rgb(167, 139, 250)",  // Violet-light
  "rgb(74, 222, 128)",   // Green
  "rgb(251, 191, 36)",   // Amber
];

// Light mode
const CHART_COLORS_LIGHT = [
  "rgb(109, 40, 217)",   // chart-1: Deeper Violet
  "rgb(192, 38, 211)",   // chart-2: Deeper Magenta
  "rgb(13, 148, 136)",   // chart-3: Deeper Teal
  "rgb(234, 88, 12)",    // chart-4: Deeper Orange
  "rgb(219, 39, 119)",   // chart-5: Deeper Pink
  "rgb(124, 58, 237)",   // Deeper Violet-light
  "rgb(22, 163, 74)",    // Deeper Green
  "rgb(217, 119, 6)",    // Deeper Amber
];
```

Special color modes for bar charts:
- `"income"`: Teal (all bars)
- `"expense"`: Rose-red (all bars)
- `"primary"`: Primary violet (all bars)
- `"mixed"`: Bars colored individually from the palette above

Income/expense colors match `income-expenses-chart.tsx`:
- Income: `isDark ? "rgba(20, 184, 166, 1)" : "rgba(13, 148, 136, 1)"`
- Expense: `isDark ? "rgba(244, 63, 94, 1)" : "rgba(225, 29, 72, 1)"`

#### Chart Common Options

All inline charts share these ECharts option defaults:

```typescript
{
  animation: true,
  animationDuration: 600,
  animationEasing: "cubicOut",
  backgroundColor: "transparent",
  grid: { left: "2%", right: "2%", bottom: "8%", top: viz.title ? "8%" : "4%", containLabel: true },
  tooltip: {
    trigger: "axis",  // or "item" for pie
    backgroundColor: isDark ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.95)",
    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    borderWidth: 1,
    textStyle: { color: textColor, fontSize: 12 },
  },
}
```

#### Pie/Donut Chart Specifics

- Default to donut (`radius: ["45%", "70%"]`). Set `radius: ["0%", "70%"]` if `donut === false`.
- `label: { show: true, formatter: "{b}: {d}%", color: textColor, fontSize: 11 }`
- `emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.2)" } }`
- Place legend at bottom: `legend: { bottom: 0, textStyle: { color: textColor, fontSize: 11 } }`

#### Stat Card

A single stat card renders as a compact inline element, not a full dashboard card:

```tsx
<div className="mt-3 flex items-center gap-4 rounded-xl border border-border
                bg-card p-4 backdrop-blur-xl dark:bg-card/80">
  <div className="flex-1 min-w-0">
    <p className="text-xs font-medium text-muted-foreground">{spec.label}</p>
    <p className="text-2xl font-bold tabular-nums text-foreground mt-0.5">
      {spec.value}
    </p>
    {spec.description && (
      <p className="text-xs text-muted-foreground mt-1">{spec.description}</p>
    )}
  </div>
  {spec.trend && spec.trendValue && (
    <div className={cn(
      "flex items-center gap-1 text-sm font-medium",
      spec.trend === "up" ? "text-emerald-500" :
      spec.trend === "down" ? "text-rose-500" :
      "text-muted-foreground"
    )}>
      {spec.trend === "up" ? <TrendingUp className="h-4 w-4" /> :
       spec.trend === "down" ? <TrendingDown className="h-4 w-4" /> :
       <Minus className="h-4 w-4" />}
      {spec.trendValue}
    </div>
  )}
</div>
```

Multiple stat cards in a single message arrange in a responsive grid:

```tsx
// When 2-3 stat cards: grid-cols-1 sm:grid-cols-2 md:grid-cols-3
// When 4+: grid-cols-2 md:grid-cols-4
<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
  {statCards.map(...)}
</div>
```

#### Table

Tables render using the shadcn `Table` component inside an `overflow-x-auto` wrapper:

```tsx
<div className="mt-3 border-t border-border pt-3">
  {spec.title && (
    <p className="mb-2 text-xs font-medium text-muted-foreground">{spec.title}</p>
  )}
  <div className="overflow-x-auto rounded-lg border border-border">
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          {spec.columns.map(col => (
            <TableHead key={col} className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {col}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {spec.rows.map((row, i) => (
          <TableRow key={i} className="border-border">
            {row.map((cell, j) => (
              <TableCell key={j} className="text-sm whitespace-nowrap py-2">
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
</div>
```

- Max height on tables: if `rows.length > 8`, wrap in a `max-h-[320px] overflow-y-auto` container.
- Amount columns: right-align cells that contain currency values (`text-right tabular-nums`).

#### "View data" Toggle

Every chart (bar, line, pie) includes a toggle to show the raw data as a table:

```tsx
function ViewDataToggle({ data, columns }: { data: ..., columns: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground
                   hover:text-foreground transition-colors"
      >
        <TableIcon className="h-3 w-3" />
        {open ? "Hide data" : "View data"}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-2 overflow-hidden"
        >
          {/* Render as compact table */}
        </motion.div>
      )}
    </div>
  );
}
```

#### Graceful Fallback for Invalid Specs

If a visualization spec fails validation (missing required fields, empty data array, unknown type), render a muted warning instead of crashing:

```tsx
<div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/20
                bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
  <span>Could not render this visualization.</span>
</div>
```

Never crash the message list because of a malformed chart spec. Wrap `InlineVisualization` in a React error boundary as a last resort.

---

## 6. Welcome & Empty States

### A. Normal Welcome State (configured + has data)

Shown when the conversation is empty, AI is configured, and transaction data exists.

```tsx
<div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
  {/* Icon */}
  <div className="flex h-16 w-16 items-center justify-center rounded-2xl
                  bg-primary/10 mb-6">
    <Sparkles className="h-8 w-8 text-primary" />
  </div>

  {/* Greeting */}
  <h2 className="text-xl font-semibold text-foreground text-center mb-2">
    What would you like to know?
  </h2>
  <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
    Ask me anything about your finances. I can analyze transactions,
    spot trends, and show you charts.
  </p>

  {/* Starter question chips */}
  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-w-lg w-full">
    {STARTER_QUESTIONS.map(q => (
      <button
        key={q.label}
        onClick={() => handleStarterClick(q.prompt)}
        className="flex items-center gap-2.5 rounded-xl border border-border
                   bg-card px-4 py-3 text-left text-sm
                   text-card-foreground backdrop-blur-xl
                   transition-all duration-200
                   hover:border-primary/30 hover:bg-card/80
                   hover:shadow-md hover:shadow-primary/5
                   dark:bg-card/60 dark:hover:bg-card/80"
      >
        <span className="text-primary shrink-0">{q.icon}</span>
        <span>{q.label}</span>
      </button>
    ))}
  </div>
</div>
```

#### The 6 Starter Questions

```typescript
const STARTER_QUESTIONS = [
  {
    icon: <ShoppingBasket className="h-4 w-4" />,
    label: "How much did I spend on groceries last month?",
    prompt: "How much did I spend on groceries last month?",
  },
  {
    icon: <TrendingUp className="h-4 w-4" />,
    label: "Show my spending trend over the past 6 months",
    prompt: "Show me my spending trend over the past 6 months as a chart.",
  },
  {
    icon: <Repeat className="h-4 w-4" />,
    label: "What are my biggest recurring expenses?",
    prompt: "What are my biggest recurring expenses?",
  },
  {
    icon: <Scale className="h-4 w-4" />,
    label: "Am I spending more than I earn?",
    prompt: "Am I spending more than I earn? Show me my income vs expenses.",
  },
  {
    icon: <Shield className="h-4 w-4" />,
    label: "How long would my savings last?",
    prompt: "How long could my savings last without any income?",
  },
  {
    icon: <CalendarClock className="h-4 w-4" />,
    label: "Compare my weekend vs weekday spending",
    prompt: "Compare how much I spend on weekdays vs weekends.",
  },
] as const;
```

Icon imports: `ShoppingBasket`, `TrendingUp`, `Repeat`, `Scale`, `Shield`, `CalendarClock` from `lucide-react`.

### B. Blocking State: AI Not Configured

Shown when no AI provider/model/key is set in settings.

```tsx
<div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
  <div className="flex h-16 w-16 items-center justify-center rounded-2xl
                  bg-muted mb-6">
    <BotMessageSquare className="h-8 w-8 text-muted-foreground" />
  </div>

  <h2 className="text-xl font-semibold text-foreground text-center mb-2">
    Set up your AI provider
  </h2>
  <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
    To use the AI Assistant, configure an API key and model in Settings.
    Your data stays local -- the AI only sees what you ask about.
  </p>

  <Button asChild>
    <Link href="/settings">
      <Settings className="mr-2 h-4 w-4" />
      Go to Settings
    </Link>
  </Button>
</div>
```

### C. Blocking State: No Transaction Data

Shown when AI is configured but there are zero transactions in the database.

```tsx
<div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
  <div className="flex h-16 w-16 items-center justify-center rounded-2xl
                  bg-muted mb-6">
    <DatabaseZap className="h-8 w-8 text-muted-foreground" />
  </div>

  <h2 className="text-xl font-semibold text-foreground text-center mb-2">
    No financial data yet
  </h2>
  <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
    Sync your bank account first so the assistant has something to analyze.
  </p>

  <Button asChild variant="outline">
    <Link href="/settings">
      <Landmark className="mr-2 h-4 w-4" />
      Connect your bank
    </Link>
  </Button>
</div>
```

### State Priority Order

Check in this order on page mount:

1. AI not configured? Show state B.
2. No transactions? Show state C.
3. Conversation empty? Show welcome state A.
4. Otherwise: show message list.

---

## 7. Error States

### Provider Error Banner

When an API call to the AI provider fails (network error, invalid key, rate limit, etc.), show a dismissible banner at the top of the message list:

```tsx
<motion.div
  initial={{ opacity: 0, y: -8 }}
  animate={{ opacity: 1, y: 0 }}
  className="mx-2 mb-4 flex items-start gap-3 rounded-lg border
             border-destructive/20 bg-destructive/5 px-4 py-3"
  role="alert"
>
  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium text-destructive">
      Failed to get a response
    </p>
    <p className="mt-0.5 text-xs text-destructive/80">
      {error.message}
    </p>
  </div>
  <div className="flex items-center gap-2 shrink-0">
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetry}
      className="h-7 text-xs border-destructive/20 text-destructive
                 hover:bg-destructive/10"
    >
      <RefreshCw className="mr-1 h-3 w-3" />
      Retry
    </Button>
    <button
      onClick={dismissError}
      className="text-destructive/60 hover:text-destructive p-1"
      aria-label="Dismiss error"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  </div>
</motion.div>
```

- Retry re-sends the last user message.
- Dismiss clears the error banner without retrying.
- The failed assistant message (if partially streamed) remains visible with a muted "Response interrupted" note appended.

### Interrupted Stream Indicator

If the stream is interrupted mid-response (network drop, user navigates away and back), append to the partial message:

```tsx
<div className="mt-2 flex items-center gap-1.5 text-xs text-amber-500">
  <AlertTriangle className="h-3 w-3" />
  <span className="italic">Response was interrupted</span>
</div>
```

---

## 8. Settings Card -- "AI Assistant"

### Placement

Add a new section on the `/settings` page between "Account Management" and any future sections:

```tsx
{/* AI Assistant section */}
<motion.section
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.35, delay: 0.3 }}
  className="flex flex-col gap-4"
>
  <h2 className="text-foreground text-lg font-semibold">
    AI Assistant
  </h2>
  <AiAssistantCard />
</motion.section>
```

Stagger delay `0.3` follows the existing pattern (Bank Connection at `0.1`, Account Management at `0.2`).

### Card Structure

Follow the exact same card pattern as `BankConnectionCard`: gradient overlay, icon + title header, status strip, form fields, footer with privacy note + action buttons.

```tsx
<Card className="border-primary/10 relative overflow-hidden">
  {/* Gradient overlay -- use a warmer purple-to-cyan for AI personality */}
  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5
                  via-transparent to-cyan-500/5 opacity-50" />

  <div className="relative z-10">
    {/* Header */}
    <CardHeader className="p-6">
      <CardTitle className="flex items-center gap-2 text-base">
        <Sparkles className="h-5 w-5 text-primary" />
        AI Assistant
      </CardTitle>
      <p className="text-muted-foreground text-sm">
        Connect an AI provider to enable the financial assistant.
      </p>
    </CardHeader>

    {/* Status strip (same AnimatePresence pattern as BankConnectionCard) */}
    <div className="px-6 pb-4">
      <StatusStrip status={cardStatus} ... />
    </div>

    {/* Form fields */}
    <CardContent className="space-y-5 px-6 pt-0">
      {/* ... fields detailed below ... */}
    </CardContent>

    {/* Footer */}
    <CardFooter className="flex-col gap-3 p-6 pt-2 sm:flex-row
                           sm:items-center sm:justify-between">
      <PrivacyNote />
      <ActionButtons />
    </CardFooter>
  </div>
</Card>
```

### Status Machine

```typescript
type AiCardStatus =
  | "not-configured"   // No provider/key set
  | "configured"       // Provider + key exist
  | "validating"       // Test Connection in progress
  | "test-success"     // Connection verified
  | "test-failure"     // Connection failed
  | "saving"           // Writing config
  | "saved"            // Config written successfully
  | "error";           // Unexpected error
```

Status strip configs (same visual pattern as BankConnectionCard):

| Status           | Icon         | Label                | Color Classes                                              |
| ---------------- | ------------ | -------------------- | ---------------------------------------------------------- |
| `not-configured` | `CloudOff`   | "Not configured"     | `bg-muted/10 border-muted-foreground/20 text-muted-foreground` |
| `configured`     | `ShieldCheck`| "Provider configured"| `bg-emerald-500/10 border-emerald-500/20 text-emerald-500` |
| `validating`     | `Loader2` (spin) | "Testing connection..." | `bg-amber-500/10 border-amber-500/20 text-amber-500` |
| `test-success`   | `CheckCircle2` | "Connection verified" | `bg-emerald-500/10 border-emerald-500/20 text-emerald-500` |
| `test-failure`   | `XCircle`    | "Connection failed"  | `bg-destructive/10 border-destructive/20 text-destructive` |
| `saving`         | `Loader2` (spin) | "Saving..."     | `bg-primary/10 border-primary/20 text-primary`             |
| `saved`          | `CheckCircle2` | "Saved successfully" | `bg-emerald-500/10 border-emerald-500/20 text-emerald-500` |
| `error`          | `AlertTriangle` | "Something went wrong" | `bg-destructive/10 border-destructive/20 text-destructive` |

### Form Field Layout

#### Provider Dropdown

```tsx
<div className="space-y-1.5">
  <label htmlFor="ai-provider" className="text-sm font-medium leading-none">
    Provider
  </label>
  <Select value={provider} onValueChange={setProvider}>
    <SelectTrigger id="ai-provider" className="bg-card border-border">
      <SelectValue placeholder="Select a provider..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="openai">OpenAI</SelectItem>
      <SelectItem value="anthropic">Anthropic</SelectItem>
      <SelectItem value="google">Google (Gemini)</SelectItem>
      <SelectItem value="ollama">Ollama (Local)</SelectItem>
    </SelectContent>
  </Select>
</div>
```

#### Model Input

```tsx
<div className="space-y-1.5">
  <label htmlFor="ai-model" className="text-sm font-medium leading-none">
    Model
  </label>
  <Input
    id="ai-model"
    value={model}
    onChange={e => setModel(e.target.value)}
    placeholder={getModelPlaceholder(provider)}
    className="bg-card border-border font-mono text-sm"
  />
  <p className="text-[11px] text-muted-foreground">
    {getModelHint(provider)}
  </p>
</div>
```

Model placeholders and hints per provider:

| Provider    | Placeholder           | Hint                                            |
| ----------- | --------------------- | ----------------------------------------------- |
| `openai`    | `"gpt-4o"`            | "e.g., gpt-4o, gpt-4o-mini, o3-mini"           |
| `anthropic` | `"claude-sonnet-4-20250514"` | "e.g., claude-sonnet-4-20250514, claude-haiku-4-20250414" |
| `google`    | `"gemini-2.5-pro"`    | "e.g., gemini-2.5-pro, gemini-2.5-flash"        |
| `ollama`    | `"llama3.1:8b"`       | "Must match a model you have pulled locally"     |

#### API Key (write-only, hidden for Ollama)

```tsx
{provider !== "ollama" && (
  <div className="space-y-1.5">
    <label htmlFor="ai-key" className="text-sm font-medium leading-none">
      API Key{" "}
      <span className="text-destructive" aria-hidden="true">*</span>
    </label>
    <div className="relative">
      <Input
        id="ai-key"
        type={keyVisible ? "text" : "password"}
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
        placeholder="sk-..."
        className="bg-card border-border pr-10 font-mono text-xs"
        autoComplete="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        aria-required="true"
      />
      <button
        type="button"
        onClick={() => setKeyVisible(v => !v)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1
                   text-muted-foreground hover:text-foreground transition-colors"
        aria-label={keyVisible ? "Hide API key" : "Show API key"}
        tabIndex={-1}
      >
        {keyVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
    <p className="text-[11px] text-muted-foreground">
      Write-only -- the key is never displayed after saving.
    </p>
  </div>
)}
```

- When an API key is already saved, show a masked indicator in the status strip detail: "API key: sk-...7x9f" (first 3 + last 4 chars).
- The input field is always empty on load (write-only pattern, same as bank cookie).

#### Base URL (Ollama only, conditional)

```tsx
{provider === "ollama" && (
  <div className="space-y-1.5">
    <label htmlFor="ai-base-url" className="text-sm font-medium leading-none">
      Base URL
    </label>
    <Input
      id="ai-base-url"
      value={baseUrl}
      onChange={e => setBaseUrl(e.target.value)}
      placeholder="http://localhost:11434"
      className="bg-card border-border font-mono text-sm"
    />
    <p className="text-[11px] text-muted-foreground">
      Default: http://localhost:11434. Change only if Ollama runs on a different port.
    </p>
  </div>
)}
```

### Conditional Field Visibility Summary

| Field      | OpenAI | Anthropic | Google | Ollama |
| ---------- | ------ | --------- | ------ | ------ |
| Provider   | Yes    | Yes       | Yes    | Yes    |
| Model      | Yes    | Yes       | Yes    | Yes    |
| API Key    | Yes    | Yes       | Yes    | No     |
| Base URL   | No     | No        | No     | Yes    |

### Footer: Privacy Note

The privacy note adapts based on the selected provider:

```tsx
<p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
  <Lock className="h-3 w-3 shrink-0" />
  {provider === "ollama" ? (
    <>Fully private -- all processing stays on your machine.</>
  ) : (
    <>Your data is sent to {providerDisplayName} for processing. No data is stored by them.</>
  )}
</p>
```

For Ollama, the privacy note gets a subtle emerald accent to draw attention:

```tsx
{provider === "ollama" && (
  <p className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-[11px]">
    <ShieldCheck className="h-3 w-3 shrink-0" />
    Fully private -- stays on your machine.
  </p>
)}
```

### Footer: Action Buttons

Same layout as BankConnectionCard:

```tsx
<div className="flex items-center gap-2 self-end sm:self-auto">
  <Button
    variant="outline"
    size="sm"
    onClick={handleTest}
    disabled={!canTest || busy}
    className="min-w-[130px]"
  >
    {isTesting ? (
      <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Testing...</>
    ) : (
      "Test Connection"
    )}
  </Button>
  <Button
    size="sm"
    onClick={handleSave}
    disabled={!canSave || busy}
    className="min-w-[80px]"
  >
    {isSaving ? (
      <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</>
    ) : (
      "Save"
    )}
  </Button>
</div>
```

`canTest` is true when provider + model are set, plus API key (if not Ollama).
`canSave` has the same condition.

### Test Connection Behavior

- **OpenAI / Anthropic / Google**: Sends a minimal "ping" message (e.g., `"Reply with OK"`) using the configured key/model. On success: shows model name and response latency in toast. On failure: shows error in status strip + toast.
- **Ollama**: Calls the Ollama `/api/tags` endpoint at the configured base URL to verify the server is running and the specified model is available. On success: confirms model exists. On failure: "Could not reach Ollama at {baseUrl}" or "Model {model} not found".

### Data Persistence

AI configuration is stored in `localStorage` under key `banking:ai-config:v1`:

```typescript
interface AiConfig {
  provider: "openai" | "anthropic" | "google" | "ollama";
  model: string;
  apiKey?: string;        // Encrypted or stored as-is (local only)
  baseUrl?: string;       // Ollama only
  configuredAt: string;   // ISO timestamp
}
```

The settings card reads/writes this key. The assistant page reads it to initialize the AI client.

---

## 9. Motion & Entrance Animations

All animations use `motion` from `"motion/react"` (the project's framer-motion import path).

### Page Entrance

The assistant page loads with a staggered entrance matching other pages:

```tsx
// Header row
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.35 }}
>

// Message list container
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.35, delay: 0.1 }}
>

// Input bar
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, delay: 0.15 }}
>
```

### Welcome State Entrance

Stagger the welcome elements:

```
Icon:             delay 0.1, duration 0.4, scale 0.8 -> 1
Title:            delay 0.15, duration 0.35
Subtitle:         delay 0.2, duration 0.35
Starter chips:    delay 0.25 + (index * 0.05), duration 0.3
```

### Message Entrance

New messages animate in:

```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.25, ease: "easeOut" }}
>
```

User messages slide from the right: `initial={{ opacity: 0, x: 12 }}`.
Assistant messages slide from the left: `initial={{ opacity: 0, x: -8 }}`.

### Inline Chart Entrance

Charts inside assistant messages fade in after the text finishes streaming:

```tsx
<motion.div
  initial={{ opacity: 0, y: 4 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, delay: 0.2 }}
>
```

### Clear Conversation

When clearing, messages exit with `AnimatePresence`:

```tsx
<motion.div
  exit={{ opacity: 0, scale: 0.95, y: -8 }}
  transition={{ duration: 0.2 }}
>
```

After all messages exit, the welcome state fades back in.

---

## 10. Accessibility

### ARIA Live Region for Streaming

The message list container must be an ARIA live region so screen readers announce new content as it streams:

```tsx
<div
  role="log"
  aria-live="polite"
  aria-label="Chat messages"
  aria-relevant="additions"
>
```

Use `role="log"` (not `role="feed"`) because messages arrive chronologically and are not user-navigable like articles.

Individual assistant messages that are actively streaming should have `aria-busy="true"` while tokens are arriving, then `aria-busy="false"` when complete.

### Focus Management

- On page load, focus the input textarea.
- After sending a message, return focus to the input textarea.
- After clearing the conversation, focus the input textarea.
- The Clear button confirmation dialog traps focus per the AlertDialog pattern (Radix handles this).

### Keyboard Navigation

| Key              | Action                                              |
| ---------------- | --------------------------------------------------- |
| `Enter`          | Send message (when input is focused and non-empty)  |
| `Shift+Enter`    | Insert newline in input                             |
| `Escape`         | If streaming, cancel/abort the stream               |
| `Tab`            | Navigate between input, Send button, Clear button   |
| `Ctrl+L`         | Clear conversation (with confirmation)              |

### Screen Reader Considerations

- Each message has `role="article"` with `aria-label="User message"` or `aria-label="Assistant message"`.
- Tool activity indicators use `aria-live="polite"` on the individual indicator container.
- Chart visualizations have `aria-label` descriptions generated from the data: e.g., `"Bar chart: Groceries 450 EUR, Dining 230 EUR, Transport 180 EUR"`.
- The "View data" toggle on charts allows screen reader users to access the raw data table.
- Status strips on the settings card use `role="status"` and `aria-live="polite"` (already established in BankConnectionCard).

### Color Contrast

- All text meets WCAG 2.1 AA contrast ratios against both light and dark backgrounds.
- Income (teal) and expense (rose) colors are distinguishable by shape/position, not just color.
- Error states use both color AND icon to convey meaning.
- The streaming cursor uses `animate-pulse` which is motion-safe; wrap in `@media (prefers-reduced-motion: reduce)` to use a static cursor instead.

---

## 11. Component Inventory & Tailwind Tokens

### File Structure

```
src/
  app/
    (dashboard)/
      assistant/
        page.tsx                  # Main assistant page (client component)
  components/
    assistant/
      message-bubble.tsx          # User + assistant message rendering
      message-list.tsx            # Scrollable message container
      chat-input.tsx              # Pinned input bar with send button
      welcome-state.tsx           # Welcome screen with starter chips
      empty-states.tsx            # AI-not-configured + no-data states
      tool-activity.tsx           # Tool activity indicator
      inline-visualization.tsx    # Chart/stat/table renderer
      view-data-toggle.tsx        # "View data" toggle for charts
      markdown-renderer.tsx       # Lightweight MD renderer for bubbles
      error-banner.tsx            # Provider error banner with retry
    settings/
      ai-assistant-card.tsx       # Settings card for AI config
```

### shadcn Components Used

| Component       | Location                          | Usage                                          |
| --------------- | --------------------------------- | ---------------------------------------------- |
| `Card` family   | `@/components/ui/card`            | Settings card, stat cards in messages           |
| `Button`        | `@/components/ui/button`          | Send, Clear, Retry, CTA buttons                |
| `Badge`         | `@/components/ui/badge`           | Model indicator in header                      |
| `Input`         | `@/components/ui/input`           | Model name, API key, base URL fields            |
| `Textarea`      | `@/components/ui/textarea`        | Chat input, cookie-style large text fields      |
| `Select`        | `@/components/ui/select`          | Provider dropdown                              |
| `AlertDialog`   | `@/components/ui/alert-dialog`    | Clear conversation confirmation                 |
| `Table`         | `@/components/ui/table`           | Inline data tables, "View data" tables          |
| `Tooltip`       | `@/components/ui/tooltip`         | Copy button tooltip, model badge hover          |
| `Skeleton`      | `@/components/ui/skeleton`        | Loading states                                  |
| `Collapsible`   | `@/components/ui/collapsible`     | "View data" toggle (optional, or use motion)    |

### New shadcn Components Needed

**None.** All required components are already installed (verified against the `src/components/ui/` inventory).

### External Dependencies

| Package              | Purpose                       | Already Installed? |
| -------------------- | ----------------------------- | ------------------ |
| `echarts-for-react`  | Chart rendering               | Yes                |
| `echarts`            | Chart engine                  | Yes                |
| `motion`             | Animations                    | Yes (`motion/react`) |
| `lucide-react`       | Icons                         | Yes                |
| `next-themes`        | Theme detection for charts    | Yes                |
| `date-fns`           | Timestamp formatting          | Yes                |
| `react-markdown`     | Markdown rendering in bubbles | **No -- install**  |
| `remark-gfm`         | GFM support for react-markdown| **No -- install**  |

**Note:** `react-markdown` and `remark-gfm` are optional. A minimal custom Markdown renderer (bold, italic, inline code, lists) can be built without external deps if the team prefers to avoid new dependencies. The custom route is recommended for bundle size.

### Tailwind Token Reference

#### Spacing

| Element                   | Token                     | Value   |
| ------------------------- | ------------------------- | ------- |
| Page outer padding        | `px-2 sm:px-4`            | 8/16px  |
| Message vertical gap      | `space-y-6`               | 24px    |
| Bubble internal padding   | `px-4 py-2.5` (user), `px-4 py-3` (assistant) | 16/10, 16/12 |
| Card internal padding     | `p-6`                     | 24px    |
| Form field gap            | `space-y-5`               | 20px    |
| Input bar vertical padding| `py-3`                    | 12px    |
| Starter chip padding      | `px-4 py-3`               | 16/12px |

#### Radii

| Element               | Token          | Resolved        |
| --------------------- | -------------- | --------------- |
| Message bubble        | `rounded-2xl`  | 1rem (16px)     |
| Bubble flat corner    | `rounded-br-md` / `rounded-tl-md` | 0.375rem (6px) |
| Input textarea        | `rounded-xl`   | 0.75rem (12px)  |
| Send button           | `rounded-lg`   | 0.5rem (8px)    |
| Starter chip          | `rounded-xl`   | 0.75rem (12px)  |
| Avatar icon container | `rounded-lg`   | 0.5rem (8px)    |
| Settings card         | `rounded-xl`   | (Card default)  |
| Inline stat card      | `rounded-xl`   | 0.75rem (12px)  |
| Chart container       | (none, contained in bubble) | -- |

#### Colors (semantic tokens, not raw values)

| Surface                    | Background                     | Border                                     | Text                    |
| -------------------------- | ------------------------------ | ------------------------------------------ | ----------------------- |
| User bubble                | `bg-primary`                   | (none)                                     | `text-primary-foreground`|
| Assistant bubble           | `bg-card dark:bg-card/80`      | `border-border`                            | `text-card-foreground`  |
| Input bar background       | `bg-background/80`            | `border-border` (top border)               | `text-foreground`       |
| Input textarea             | `bg-card`                      | `border-border focus:border-primary/40`    | `text-foreground`       |
| Starter chip               | `bg-card dark:bg-card/60`      | `border-border hover:border-primary/30`    | `text-card-foreground`  |
| Header row                 | (transparent)                  | `border-border` (bottom border)            | `text-foreground`       |
| Error banner               | `bg-destructive/5`             | `border-destructive/20`                    | `text-destructive`      |
| Tool activity (running)    | (transparent)                  | (none)                                     | `text-muted-foreground` |
| Settings card overlay      | `from-violet-500/5 to-cyan-500/5` | (none)                                  | (none)                  |

#### Typography

| Element                | Classes                                           |
| ---------------------- | ------------------------------------------------- |
| Page title (header)    | `text-lg font-semibold text-foreground`           |
| Model badge            | `text-[11px] font-mono`                           |
| Message text           | `text-sm leading-relaxed`                         |
| Timestamp              | `text-[10px] text-muted-foreground tabular-nums`  |
| Tool activity label    | `text-xs italic text-muted-foreground`            |
| Tool name              | `font-mono text-[10px] text-muted-foreground/60`  |
| Chart title            | `text-xs font-medium text-muted-foreground`       |
| Stat card value        | `text-2xl font-bold tabular-nums text-foreground` |
| Stat card label        | `text-xs font-medium text-muted-foreground`       |
| Welcome title          | `text-xl font-semibold text-foreground`           |
| Welcome subtitle       | `text-sm text-muted-foreground`                   |
| Starter chip text      | `text-sm text-card-foreground`                    |
| Disclaimer             | `text-[11px] text-muted-foreground`               |
| Settings field label   | `text-sm font-medium leading-none`                |
| Settings field hint    | `text-[11px] text-muted-foreground`               |
| Privacy note           | `text-[11px] text-muted-foreground`               |

### Conversation Persistence

Single conversation stored in `localStorage` under key `banking:assistant:conversation:v1`:

```typescript
interface PersistedConversation {
  messages: ChatMessage[];
  updatedAt: string;  // ISO timestamp
}
```

- Load on mount (SSR-safe: read in lazy `useState` initializer, same pattern as `useScenarios`).
- Persist on every new message or stream completion via `useEffect`.
- "Clear conversation" removes the key entirely.
- No pagination or archiving. If the conversation gets very long (>200 messages), show a subtle hint: "Long conversation -- consider clearing for better performance."

### localStorage Key Summary

| Key                                  | Owner            | Content                  |
| ------------------------------------ | ---------------- | ------------------------ |
| `banking:ai-config:v1`              | Settings card    | Provider, model, key     |
| `banking:assistant:conversation:v1` | Assistant page   | Message history          |

---

## Appendix: Quick-Reference for Implementer

### Do

- Use `border-border` everywhere (NEVER `border-white/10` without a dark: qualifier).
- Use `bg-card dark:bg-card/80` for glass cards (opaque in light, translucent in dark).
- Use `useTheme()` + `resolvedTheme` for chart color branching.
- Use `"motion/react"` import path (not `"framer-motion"`).
- Use `motion.create(Card)` for `MotionCard` (existing project pattern).
- Use `crypto.randomUUID()` for message IDs.
- Use `de-DE` locale for all currency formatting.
- Use `Sonner` toasts for save/test feedback (via `toast.success()` / `toast.error()`).

### Do Not

- Do not use `border-white/10` or `border-white/5` as standalone border classes.
- Do not add `<h1>` tags -- the page title is in the header row, not a semantic heading.
- Do not render headings (h1-h6) inside message bubbles.
- Do not auto-play sounds or add notification badges.
- Do not persist the API key in `sessionStorage` (only `localStorage`).
- Do not send the full conversation history to the AI on every turn -- use a sliding window or summarization strategy (implementation detail, not UI concern).
