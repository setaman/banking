import React, { useMemo, useState } from "react";
import { useArgs, useGlobals, useStorybookApi, useStorybookState } from "storybook/manager-api";

import { buildPrompt, claudeAppPrompt, copyText, repoPath, storyLabel } from "./composer";
import type { Basket, BasketStory } from "./composer";
import { btn, muted } from "./shared";
import type { Flow, Picked } from "./shared";

const LINE = "1px solid rgba(128,128,128,0.25)";
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7 };
const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "1px solid rgba(128,128,128,0.4)",
  borderRadius: 999,
  padding: "2px 4px 2px 10px",
  fontSize: 11,
  maxWidth: "100%",
};
const xBtn: React.CSSProperties = { border: 0, background: "transparent", color: "inherit", cursor: "pointer", opacity: 0.6, padding: "0 4px", font: "inherit" };

interface IndexEntry {
  id: string;
  type: string;
  title: string;
  name: string;
  importPath: string;
}

export function ComposerView({
  flow,
  basket,
  setBasket,
  request,
  setRequest,
  termConnected,
  onSendToTerminal,
}: {
  flow: Flow | null;
  basket: Basket;
  setBasket: (fn: (b: Basket) => Basket) => void;
  request: string;
  setRequest: (s: string) => void;
  termConnected: boolean;
  onSendToTerminal: (prompt: string) => void;
}): React.ReactElement {
  const api = useStorybookApi();
  const state = useStorybookState();
  const [args] = useArgs();
  const [globals] = useGlobals();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<"prompt" | "app" | null>(null);
  const origin = window.location.origin;
  const current = api.getCurrentStoryData() as unknown as (IndexEntry & { type: string }) | undefined;
  const currentId = current?.type === "story" ? current.id : null;

  const entries = useMemo<IndexEntry[]>(() => {
    const idx = ((state as unknown as { index?: Record<string, IndexEntry> }).index ?? {}) as Record<string, IndexEntry>;
    return Object.values(idx).filter((e) => e.type === "story");
  }, [state]);

  const prompt = useMemo(() => buildPrompt({ flow, request, basket, origin }), [flow, request, basket, origin]);
  const isEmpty = !basket.stories.length && !basket.elements.length && !request.trim();

  const addStory = (e: IndexEntry, live: boolean): void => {
    const s: BasketStory = {
      id: e.id,
      title: e.title,
      name: e.name,
      importPath: repoPath(e.importPath),
      args: live ? ((args ?? {}) as Record<string, unknown>) : {},
      globals: live ? ((globals ?? {}) as Record<string, unknown>) : {},
    };
    setBasket((b) => (b.stories.some((x) => x.id === s.id) ? b : { ...b, stories: [...b.stories, s] }));
  };
  const addCurrent = (): void => {
    if (current && currentId) addStory(current, true);
  };
  const removeStory = (id: string): void => setBasket((b) => ({ ...b, stories: b.stories.filter((s) => s.id !== id) }));
  const removeEl = (i: number): void => setBasket((b) => ({ ...b, elements: b.elements.filter((_, j) => j !== i) }));

  const flash = (k: "prompt" | "app"): void => {
    setCopied(k);
    setTimeout(() => setCopied(null), 2000);
  };

  const matches = query.trim()
    ? entries.filter((e) => `${e.title} ${e.name}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : entries.slice(0, 8);

  const elLabel = (p: Picked): string => `${p.componentName} <${p.tagName}>${p.source ? ` ${repoPath(p.source.file)}:${p.source.line}` : ""}`;

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 14 }}>
      {isEmpty && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, ...muted }}>
          <span>① Pick a flow</span>·<span>② Add stories or pick elements</span>·<span>③ Describe &amp; copy to your agent</span>
        </div>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={sectionTitle}>Basket</span>
          <span style={{ flex: 1 }} />
          {(basket.stories.length > 0 || basket.elements.length > 0) && (
            <button style={{ ...btn(), padding: "1px 8px", fontSize: 11 }} onClick={() => setBasket(() => ({ stories: [], elements: [] }))}>
              Clear all
            </button>
          )}
        </div>

        <div style={{ ...muted, fontSize: 11 }}>Stories</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {basket.stories.map((s) => (
            <span key={s.id} style={chip} title={`${s.importPath}\n${s.id}`}>
              {storyLabel(s)}
              <button style={xBtn} aria-label={`Remove ${storyLabel(s)}`} onClick={() => removeStory(s.id)}>
                ✕
              </button>
            </span>
          ))}
          {!basket.stories.length && <span style={{ ...muted, fontSize: 11 }}>No stories yet</span>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btn()} onClick={addCurrent} disabled={!currentId} title={currentId ? `Add ${current?.title} · ${current?.name}` : "Open a story first"}>
            + Add current story
          </button>
          <button style={btn(adding)} onClick={() => setAdding((a) => !a)}>
            Add story…
          </button>
        </div>
        {adding && (
          <div style={{ border: LINE, borderRadius: 6, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stories…"
              aria-label="Search stories"
              style={{ font: "inherit", fontSize: 12, padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit" }}
            />
            <div style={{ maxHeight: 160, overflow: "auto", display: "flex", flexDirection: "column" }}>
              {matches.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    addStory(e, e.id === currentId);
                    setAdding(false);
                    setQuery("");
                  }}
                  style={{ ...btn(), border: 0, textAlign: "left", padding: "3px 6px" }}
                >
                  {e.title} · {e.name}
                </button>
              ))}
              {!matches.length && <span style={{ ...muted, fontSize: 11, padding: 4 }}>No match</span>}
            </div>
          </div>
        )}

        <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>Elements</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {basket.elements.map((p, i) => (
            <span key={i} style={chip} title={String(p.text ?? "")}>
              {elLabel(p)}
              <button style={xBtn} aria-label={`Remove ${p.componentName}`} onClick={() => removeEl(i)}>
                ✕
              </button>
            </span>
          ))}
          {!basket.elements.length && <span style={{ ...muted, fontSize: 11 }}>Use “🎯 Pick element” above, then click in the preview</span>}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={sectionTitle}>Request</span>
        <textarea
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="Describe what you want…"
          rows={4}
          style={{ font: "inherit", fontSize: 13, padding: 8, borderRadius: 6, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", resize: "vertical" }}
        />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ ...sectionTitle, border: 0, background: "transparent", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0 }}>
          {open ? "▾" : "▸"} Prompt preview
        </button>
        {open && (
          <pre style={{ margin: 0, padding: 10, border: LINE, borderRadius: 6, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, background: "rgba(128,128,128,0.08)" }}>
            {prompt}
          </pre>
        )}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            style={{ ...btn(true), padding: "6px 14px" }}
            onClick={() => void copyText(prompt).then(() => flash("prompt"))}
          >
            {copied === "prompt" ? "Copied ✓" : "📋 Copy prompt"}
          </button>
          <button
            style={{ ...btn(), opacity: termConnected ? 1 : 0.5, cursor: termConnected ? "pointer" : "not-allowed" }}
            disabled={!termConnected}
            title={termConnected ? "Paste the prompt into the terminal (no Enter)" : "Terminal server not running — start with npm run storybook"}
            onClick={() => onSendToTerminal(prompt)}
          >
            ⌨️ Send to Terminal
          </button>
          <button
            style={btn()}
            onClick={() => void copyText(claudeAppPrompt(origin, currentId)).then(() => flash("app"))}
          >
            {copied === "app" ? "Copied ✓" : "🌐 Open in Claude app"}
          </button>
        </div>
        <span style={{ ...muted, fontSize: 11 }}>Working in the Claude app? Use this to open Storybook in its built-in browser.</span>
      </section>
    </div>
  );
}
