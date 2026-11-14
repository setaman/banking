/* Preview-side element picker for the AI Chat addon. */
import { addons } from "storybook/preview-api";

interface StoryCtx {
  id: string;
  title: string;
  name: string;
  args: unknown;
}

let currentStory: StoryCtx | null = null;

export function recordStory(ctx: StoryCtx): void {
  currentStory = ctx;
}

const STYLE_KEYS = [
  "color", "backgroundColor", "fontSize", "fontWeight", "lineHeight", "padding",
  "margin", "borderRadius", "border", "display", "gap", "width", "height",
] as const;

type AnyFiber = {
  type?: unknown;
  return?: AnyFiber | null;
};

function fiberOf(el: Element): AnyFiber | null {
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  return key ? ((el as unknown as Record<string, AnyFiber>)[key] ?? null) : null;
}

function nameOfType(type: unknown): string | null {
  if (!type) return null;
  if (typeof type === "function") {
    const f = type as { displayName?: string; name?: string };
    return f.displayName || f.name || null;
  }
  if (typeof type === "object") {
    const o = type as { displayName?: string; render?: unknown; type?: unknown };
    return o.displayName || nameOfType(o.render) || nameOfType(o.type);
  }
  return null;
}

const SKIP = /^(Story|Decorated|StoryFn|Root|Provider|Suspense|ErrorBoundary|Preview|Unnamed|Anonymous|Context|Primitive|Slot|SlotClone|Fragment|PortalProvider|.*Wrapper.*|.*Boundary.*|.*Router.*|.*Handler.*)$/;

function componentStack(el: Element): string[] {
  const names: string[] = [];
  let f: AnyFiber | null | undefined = fiberOf(el);
  while (f && names.length < 6) {
    if (typeof f.type !== "string") {
      const n = nameOfType(f.type);
      if (n && !SKIP.test(n) && n !== "anonymous" && n !== names[names.length - 1]) names.push(n);
    }
    f = f.return;
  }
  return names;
}

function sourceOf(el: Element): { file: string; line: number; column: number } | null {
  const tagged = el.closest("[data-sb-source]");
  const v = tagged?.getAttribute("data-sb-source");
  if (!v) return null;
  const m = /^(.*):(\d+):(\d+)$/.exec(v);
  return m ? { file: m[1], line: Number(m[2]), column: Number(m[3]) } : null;
}

function buildPayload(el: Element) {
  const stack = componentStack(el);
  const cs = getComputedStyle(el);
  const computedStyles: Record<string, string> = {};
  for (const k of STYLE_KEYS) computedStyles[k] = cs[k];
  return {
    componentName: stack[0] ?? el.tagName.toLowerCase(),
    componentStack: stack,
    source: sourceOf(el),
    storyId: currentStory?.id ?? null,
    storyTitle: currentStory?.title ?? null,
    args: safeArgs(currentStory?.args),
    tagName: el.tagName.toLowerCase(),
    text: ((el as HTMLElement).innerText ?? el.textContent ?? "").trim().slice(0, 200),
    className: typeof el.className === "string" ? el.className : "",
    computedStyles,
    outerHTML: el.outerHTML.slice(0, 1500),
  };
}

function safeArgs(args: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(args ?? {}));
  } catch {
    return {};
  }
}

let picking = false;
let box: HTMLDivElement | null = null;
let label: HTMLDivElement | null = null;
let prevCursor = "";

function isOverlay(t: EventTarget | null): boolean {
  return t instanceof Node && (t === box || t === label || !!box?.contains(t));
}

function labelText(el: Element): string {
  const name = componentStack(el)[0] ?? el.tagName.toLowerCase();
  const s = sourceOf(el);
  return `${name} · ${el.tagName.toLowerCase()}${s ? ` · ${s.file}:${s.line}` : ""}`;
}

function onMove(e: MouseEvent): void {
  const el = e.target as Element | null;
  if (!el || isOverlay(el) || !box || !label) return;
  const r = el.getBoundingClientRect();
  Object.assign(box.style, {
    display: "block", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
  });
  label.textContent = labelText(el);
  label.style.top = r.top > 24 ? "-22px" : `${r.height + 2}px`;
}

function stopEvent(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
}

function onClick(e: MouseEvent): void {
  stopEvent(e);
  const el = e.target as Element | null;
  if (!el || isOverlay(el)) return;
  const payload = buildPayload(el);
  exit();
  addons.getChannel().emit("ai-chat/picked", payload);
}

function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    exit();
    addons.getChannel().emit("ai-chat/pick-cancelled");
  }
}

function enter(): void {
  if (picking) return;
  picking = true;
  box = document.createElement("div");
  Object.assign(box.style, {
    position: "fixed", pointerEvents: "none", zIndex: "2147483647", display: "none",
    outline: "2px solid #a78bfa", background: "rgba(167,139,250,0.18)", boxSizing: "border-box",
  });
  label = document.createElement("div");
  Object.assign(label.style, {
    position: "absolute", left: "0", whiteSpace: "nowrap", pointerEvents: "none",
    font: "11px/16px ui-monospace, monospace", background: "#7c3aed", color: "#fff", padding: "1px 6px",
    borderRadius: "3px",
  });
  box.appendChild(label);
  document.body.appendChild(box);
  prevCursor = document.documentElement.style.cursor;
  document.documentElement.style.cursor = "crosshair";
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("mousedown", stopEvent, true);
  document.addEventListener("mouseup", stopEvent, true);
  document.addEventListener("keydown", onKey, true);
}

function exit(): void {
  if (!picking) return;
  picking = false;
  box?.remove();
  box = null;
  label = null;
  document.documentElement.style.cursor = prevCursor;
  document.removeEventListener("mousemove", onMove, true);
  document.removeEventListener("click", onClick, true);
  document.removeEventListener("mousedown", stopEvent, true);
  document.removeEventListener("mouseup", stopEvent, true);
  document.removeEventListener("keydown", onKey, true);
}

const channel = addons.getChannel();
channel.on("ai-chat/pick-start", enter);
channel.on("ai-chat/pick-cancel", () => {
  exit();
  channel.emit("ai-chat/pick-cancelled");
});
