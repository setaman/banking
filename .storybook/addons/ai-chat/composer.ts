/* Composer: basket types, storage and the markdown prompt builder. */
import type { Flow, Picked } from "./shared";

export interface BasketStory {
  id: string;
  title: string;
  name: string;
  importPath: string;
  args: Record<string, unknown>;
  globals: Record<string, unknown>;
}
export interface Basket {
  stories: BasketStory[];
  elements: Picked[];
}
export const EMPTY_BASKET: Basket = { stories: [], elements: [] };
const LS_BASKET = "ai-chat:basket";

export function loadBasket(): Basket {
  try {
    const b = JSON.parse(
      localStorage.getItem(LS_BASKET) ?? "null"
    ) as Partial<Basket> | null;
    if (b && Array.isArray(b.stories) && Array.isArray(b.elements))
      return { stories: b.stories, elements: b.elements };
  } catch {
    /* ignore */
  }
  return EMPTY_BASKET;
}
export function saveBasket(b: Basket): void {
  try {
    localStorage.setItem(LS_BASKET, JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

export const COMPOSER_ADD_EVENT = "ai-chat:composer-add";

/**
 * Add a story to the persisted basket from anywhere in the manager (e.g. the
 * sidebar), even when the panel is not mounted. Returns false if it was already
 * in the basket. Mounted panels pick the change up via COMPOSER_ADD_EVENT.
 */
export function addStoryToBasket(story: BasketStory): boolean {
  const b = loadBasket();
  if (b.stories.some((s) => s.id === story.id)) return false;
  saveBasket({ ...b, stories: [...b.stories, story] });
  window.dispatchEvent(new CustomEvent(COMPOSER_ADD_EVENT, { detail: story }));
  return true;
}

/** Repo-relative path (`src/...`) from an index importPath or picker file. */
export function repoPath(p: string): string {
  const s = p.replace(/\\/g, "/");
  const i = s.indexOf("/src/");
  if (i >= 0) return s.slice(i + 1);
  return s.replace(/^(\.\/|\/)+/, "");
}

export const elementKey = (p: Picked): string =>
  `${p.source ? `${repoPath(p.source.file)}:${p.source.line}` : p.componentName}|${String(p.storyId ?? "")}`;

/** Keep the stored element small (drop outerHTML). */
export function slimElement(p: Picked): Picked {
  const { outerHTML: _drop, ...rest } = p;
  void _drop;
  return rest as Picked;
}

const one = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Storybook URL format: key:value;key2:value2 (primitives only). */
export function encodeParam(o: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (!/^[\w.-]+$/.test(k)) continue;
    if (typeof v === "string") {
      if (/^[\w .\-!~*'()%]*$/.test(v))
        parts.push(`${k}:${v.replace(/ /g, "+")}`);
    } else if (typeof v === "number" && Number.isFinite(v))
      parts.push(`${k}:${v}`);
    else if (typeof v === "boolean") parts.push(`${k}:!${v}`);
    else if (v === null) parts.push(`${k}:!null`);
    else if (v === undefined) parts.push(`${k}:!undefined`);
  }
  return parts.join(";");
}

export function storyViewUrl(s: BasketStory, origin: string): string {
  const a = encodeParam(s.args);
  const g = encodeParam(
    Object.fromEntries(
      Object.entries(s.globals).filter(
        ([k, v]) => !(v === false && /^(measureEnabled|outline)$/.test(k))
      )
    )
  );
  let u = `${origin}/iframe.html?id=${s.id}&viewMode=story`;
  if (a) u += `&args=${encodeURIComponent(a)}`;
  if (g) u += `&globals=${encodeURIComponent(g)}`;
  return u;
}

const WRAPPER =
  /^(hookified|StyleSheetContext|StyleRegistry|Story|Decorated.*|.*Provider|.*Boundary|Router.*|.*Router|.*Context|AppRouter.*|Segment.*|Layout.*Router|PreviewRender|.*Wrapper)$/;

function stackOf(p: Picked): string[] {
  const st = Array.isArray(p.componentStack)
    ? (p.componentStack as unknown[]).map(String)
    : [];
  return st.filter((n) => !WRAPPER.test(n));
}

const KEY_STYLES = [
  "color",
  "backgroundColor",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "padding",
  "margin",
  "borderRadius",
  "display",
  "gap",
];

export function elementLine(p: Picked): string {
  const parts: string[] = [];
  const st = stackOf(p);
  parts.push(
    `${p.componentName}${st.length > 1 ? ` (stack: ${st.join(" > ")})` : ""}`
  );
  parts.push(
    `<${p.tagName}>${p.source ? ` at \`${repoPath(p.source.file)}:${p.source.line}:${p.source.column}\`` : ""}`
  );
  if (p.storyId) parts.push(`story \`${String(p.storyId)}\``);
  if (p.className)
    parts.push(`classes "${one(String(p.className)).slice(0, 200)}"`);
  const cs = p.computedStyles as Record<string, string> | undefined;
  if (cs && typeof cs === "object") {
    const ks = KEY_STYLES.filter((k) => cs[k] != null && cs[k] !== "")
      .slice(0, 8)
      .map((k) => `${k}=${one(String(cs[k]))}`);
    if (ks.length) parts.push(`styles ${ks.join(", ")}`);
  }
  if (p.text) parts.push(`text "${one(String(p.text)).slice(0, 120)}"`);
  return `- ${parts.join(" · ")}`;
}

export const storyLabel = (s: BasketStory): string => `${s.title} · ${s.name}`;

export function buildPrompt(opts: {
  flow: Flow | null;
  request: string;
  basket: Basket;
  origin: string;
}): string {
  const { flow, request, basket, origin } = opts;
  const out: string[] = [];
  if (flow)
    out.push(
      `## Task\nFlow: ${flow.emoji} ${flow.label} — ${one(flow.instructions)}`
    );
  if (request.trim()) out.push(`## Request\n${request.trim()}`);
  if (basket.stories.length) {
    const lines = basket.stories.map((s) => {
      const l = [
        `- ${storyLabel(s)} — file \`${repoPath(s.importPath)}\` — id \`${s.id}\``,
        `  view: ${storyViewUrl(s, origin)}`,
      ];
      if (Object.keys(s.args).length) {
        let j = "";
        try {
          j = JSON.stringify(s.args);
        } catch {
          /* ignore */
        }
        if (j) l.push(`  args: ${j.length > 300 ? `${j.slice(0, 300)}…` : j}`);
      }
      return l.join("\n");
    });
    out.push(`## Stories\n${lines.join("\n")}`);
  }
  if (basket.elements.length)
    out.push(
      `## Selected elements\n${basket.elements.map(elementLine).join("\n")}`
    );
  out.push(
    `## Working agreements
- Reuse components from src/components/ui and design tokens (globals.css); no hardcoded colours or arbitrary spacing.
- New pages/prototypes go into new *.stories.tsx files.
- Storybook runs at ${origin} and hot-reloads. To check your work visually, open the story's view URL above in your browser tool and take a screenshot before you report back.`
  );
  return out.join("\n\n");
}

export function claudeAppPrompt(
  origin: string,
  storyId: string | null
): string {
  const url = storyId ? `${origin}/?path=/story/${storyId}` : origin;
  return `In this repo, start Storybook with \`npm run storybook:only\` if it isn't running yet, then open ${url} in your built-in browser.`;
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fall through */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}
