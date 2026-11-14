import type React from "react";

export interface Picked {
  componentName: string;
  tagName: string;
  source: { file: string; line: number; column: number } | null;
  [k: string]: unknown;
}
export interface Flow {
  id: string;
  label: string;
  emoji: string;
  instructions: string;
}

export const FALLBACK_FLOWS: Flow[] = [
  { id: "prototype", label: "Prototype", emoji: "🧪", instructions: "Quickly prototype the requested UI as a new story; keep it simple." },
  { id: "research", label: "Research", emoji: "🔎", instructions: "Research only: explore the code and explain; do not edit files." },
  { id: "tweak", label: "Tweak", emoji: "🎨", instructions: "Make a small, focused visual tweak to the selected element." },
  { id: "new-page", label: "New page", emoji: "📄", instructions: "Create a new page using existing components and the Neo-Glass theme." },
  { id: "review", label: "Review", emoji: "🧐", instructions: "Review the selected component for quality, a11y and consistency; do not edit." },
];

export const muted = { opacity: 0.65 } as const;
export const btn = (active = false): React.CSSProperties => ({
  border: "1px solid rgba(128,128,128,0.4)",
  background: active ? "#7c3aed" : "transparent",
  color: active ? "#fff" : "inherit",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  cursor: "pointer",
  font: "inherit",
});

const one = (s: string): string => s.replace(/\s+/g, " ").trim();

const KEY_STYLES = ["color", "backgroundColor", "fontSize", "fontWeight", "padding", "margin", "borderRadius", "display"];

/** Compact single-line description of a picked element. */
export function selectionLine(p: Picked): string {
  const parts: string[] = [];
  const stack = Array.isArray(p.componentStack) ? (p.componentStack as unknown[]).map(String) : [];
  parts.push(`Component: ${p.componentName}${stack.length ? ` (stack: ${stack.join(" > ")})` : ""}`);
  parts.push(`<${p.tagName}>${p.source ? ` at ${p.source.file}:${p.source.line}:${p.source.column}` : ""}`);
  if (p.storyId) parts.push(`story ${String(p.storyId)}`);
  if (p.args && typeof p.args === "object" && Object.keys(p.args as object).length) {
    let j = "";
    try {
      j = JSON.stringify(p.args);
    } catch {
      /* ignore */
    }
    if (j) parts.push(`args ${j.length > 300 ? `${j.slice(0, 300)}…` : j}`);
  }
  if (p.className) parts.push(`classes "${one(String(p.className)).slice(0, 200)}"`);
  const cs = p.computedStyles as Record<string, string> | undefined;
  if (cs && typeof cs === "object") {
    const ks = KEY_STYLES.filter((k) => cs[k] != null && cs[k] !== "").map((k) => `${k}=${one(String(cs[k]))}`);
    if (ks.length) parts.push(`key styles ${ks.join(", ")}`);
  }
  if (p.text) parts.push(`text "${one(String(p.text)).slice(0, 120)}"`);
  return `[Storybook selection] ${parts.join(" · ")}`;
}

export function flowLine(f: Flow): string {
  return `[Flow: ${f.label}] ${one(f.instructions)}`;
}

/** Text pasted into the terminal prompt (no trailing newline / Enter). */
export function insertionText(p: Picked | null, f: Flow | null): string {
  const lines: string[] = [];
  if (f) lines.push(flowLine(f));
  if (p) lines.push(selectionLine(p));
  lines.push("Request: ");
  return lines.join("\n");
}
