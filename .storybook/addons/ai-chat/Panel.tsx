import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChannel } from "storybook/manager-api";
import type { API } from "storybook/manager-api";

const SERVER = "http://127.0.0.1:6100";
const LS_KEY = "ai-chat:v1";
const LS_MODEL = "ai-chat:model";
interface ModelOpt {
  id: string;
  label: string;
}
const FALLBACK_MODELS: ModelOpt[] = [
  { id: "", label: "Default (your Claude Code setting)" },
  { id: "opus", label: "Opus" },
  { id: "sonnet", label: "Sonnet" },
  { id: "haiku", label: "Haiku" },
];

interface Picked {
  componentName: string;
  tagName: string;
  source: { file: string; line: number; column: number } | null;
  [k: string]: unknown;
}
interface ChangedFile {
  status: string;
  path: string;
}
type Msg =
  | { kind: "user"; text: string; chip?: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; text: string }
  | { kind: "error"; text: string }
  | { kind: "summary"; durationMs?: number; files: ChangedFile[]; ok?: boolean; model?: string };

const chipLabel = (p: Picked): string =>
  `${p.componentName} <${p.tagName}>${p.source ? ` ${p.source.file}:${p.source.line}` : ""}`;

const TOOL_ICON: Record<string, string> = { Edit: "✎", MultiEdit: "✎", Write: "✎", Read: "👁", Grep: "🔍", Glob: "🔍", Bash: "$" };

function load(): { messages: Msg[]; sessionId: string | null } {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) ?? "null");
    if (v && Array.isArray(v.messages)) return { messages: v.messages, sessionId: v.sessionId ?? null };
  } catch {
    /* ignore */
  }
  return { messages: [], sessionId: null };
}

const muted = { opacity: 0.65 } as const;
const btn = (active = false): React.CSSProperties => ({
  border: "1px solid rgba(128,128,128,0.4)",
  background: active ? "#7c3aed" : "transparent",
  color: active ? "#fff" : "inherit",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  cursor: "pointer",
  font: "inherit",
});

export function Panel({ active, api }: { active: boolean; api: API }): React.ReactElement {
  const init = useRef(load());
  const [messages, setMessages] = useState<Msg[]>(init.current.messages);
  const [sessionId, setSessionId] = useState<string | null>(init.current.sessionId);
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [picking, setPicking] = useState(false);
  const [up, setUp] = useState(false);
  const [models, setModels] = useState<ModelOpt[]>(FALLBACK_MODELS);
  const [model, setModel] = useState<string>(() => {
    try {
      return localStorage.getItem(LS_MODEL) ?? "";
    } catch {
      return "";
    }
  });
  const modelRef = useRef(model);
  modelRef.current = model;
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;

  const emit = useChannel({
    "ai-chat/picked": (p: Picked) => {
      setPicked(p);
      setPicking(false);
      api.setSelectedPanel("ai-chat/panel");
    },
    "ai-chat/pick-cancelled": () => setPicking(false),
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ messages: messages.slice(-200), sessionId }));
    } catch {
      /* ignore */
    }
  }, [messages, sessionId]);

  useEffect(() => {
    fetch(`${SERVER}/models`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((l: ModelOpt[]) => Array.isArray(l) && l.length > 0 && setModels(l))
      .catch(() => undefined);
  }, []);

  const changeModel = (v: string) => {
    setModel(v);
    try {
      localStorage.setItem(LS_MODEL, v);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`${SERVER}/health`);
        if (alive) setUp(r.ok);
      } catch {
        if (alive) setUp(false);
      }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, running]);

  const togglePick = () => {
    if (picking) {
      emit("ai-chat/pick-cancel");
      setPicking(false);
    } else {
      emit("ai-chat/pick-start");
      setPicking(true);
    }
  };

  const appendText = (text: string) =>
    setMessages((m) => {
      const last = m[m.length - 1];
      if (last?.kind === "assistant") return [...m.slice(0, -1), { kind: "assistant", text: `${last.text}\n\n${text}` }];
      return [...m, { kind: "assistant", text }];
    });

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || running) return;
    const ctx = picked;
    setMessages((m) => [...m, { kind: "user", text: message, chip: ctx ? chipLabel(ctx) : undefined }]);
    setInput("");
    setPicked(null);
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    let files: ChangedFile[] = [];
    let durationMs: number | undefined;
    let ok: boolean | undefined;
    let usedModel: string | undefined;
    try {
      const res = await fetch(`${SERVER}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: sessionRef.current ?? undefined, context: ctx ?? undefined, model: modelRef.current || undefined }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        setMessages((m) => [...m, { kind: "error", text: res.status === 409 ? "Server is busy with another run." : `Server error ${res.status}` }]);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const line = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let ev: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
          try {
            ev = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (ev.type === "session") {
            setSessionId(ev.sessionId);
            usedModel = ev.model;
          }
          else if (ev.type === "text") appendText(ev.text);
          else if (ev.type === "tool")
            setMessages((m) => [...m, { kind: "tool", text: `${TOOL_ICON[ev.name] ?? "•"} ${ev.name} ${ev.summary ?? ""}` }]);
          else if (ev.type === "error") setMessages((m) => [...m, { kind: "error", text: ev.message }]);
          else if (ev.type === "result") {
            durationMs = ev.durationMs;
            ok = ev.ok;
          } else if (ev.type === "changes") files = ev.files ?? [];
        }
      }
      setMessages((m) => [...m, { kind: "summary", durationMs, files, ok, model: usedModel }]);
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setMessages((m) => [...m, { kind: "error", text: `Connection failed: ${(e as Error).message}` }]);
      else setMessages((m) => [...m, { kind: "tool", text: "■ Stopped" }]);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [input, running, picked]);

  const stop = () => {
    fetch(`${SERVER}/stop`, { method: "POST" }).catch(() => undefined);
    abortRef.current?.abort();
  };

  const newChat = () => {
    if (running) stop();
    setMessages([]);
    setSessionId(null);
    setPicked(null);
  };

  return (
    <div
      style={{
        display: active ? "flex" : "none",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
        fontSize: 13,
        lineHeight: 1.45,
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(128,128,128,0.25)" }}>
        <span
          title={up ? "AI server connected" : "AI server down"}
          style={{ width: 9, height: 9, borderRadius: "50%", background: up ? "#22c55e" : "#ef4444", flex: "none" }}
        />
        {!up && <span style={{ ...muted, fontSize: 11 }}>run npm run storybook</span>}
        <span style={{ flex: 1 }} />
        <select
          aria-label="Model"
          value={model}
          onChange={(e) => changeModel(e.target.value)}
          style={{ ...btn(), padding: "3px 4px", maxWidth: 130, background: "transparent" }}
        >
          {models.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button style={btn(picking)} onClick={togglePick} title="Click an element in the preview">
          🎯 Pick element
        </button>
        <button style={btn()} onClick={newChat}>
          New chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ ...muted, textAlign: "center", marginTop: 24 }}>
            Pick an element, then describe the change you want.
          </div>
        )}
        {messages.map((m, i) => {
          if (m.kind === "user")
            return (
              <div key={i} style={{ alignSelf: "flex-end", maxWidth: "85%", background: "rgba(124,58,237,0.85)", color: "#fff", borderRadius: 10, padding: "6px 10px" }}>
                {m.chip && <div style={{ fontSize: 11, opacity: 0.8, fontFamily: "monospace", marginBottom: 2 }}>🎯 {m.chip}</div>}
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            );
          if (m.kind === "assistant")
            return (
              <div key={i} style={{ whiteSpace: "pre-wrap", background: "rgba(128,128,128,0.14)", borderRadius: 10, padding: "6px 10px", maxWidth: "95%" }}>
                {m.text}
              </div>
            );
          if (m.kind === "tool")
            return (
              <div key={i} style={{ ...muted, fontSize: 11, fontFamily: "monospace", wordBreak: "break-all" }}>
                {m.text}
              </div>
            );
          if (m.kind === "error")
            return (
              <div key={i} style={{ color: "#ef4444", whiteSpace: "pre-wrap" }}>
                {m.text}
              </div>
            );
          return (
            <div key={i} style={{ border: "1px solid rgba(128,128,128,0.35)", borderRadius: 8, padding: 8, fontSize: 12 }}>
              <div>
                {m.ok === false ? "⚠ Finished with errors" : "✓ Done"}
                {m.durationMs != null && ` in ${(m.durationMs / 1000).toFixed(1)}s`}
              </div>
              {m.model && <div style={{ ...muted, fontSize: 11 }}>model: {m.model}</div>}
              {m.files.length > 0 ? (
                <>
                  <div style={{ marginTop: 4, ...muted }}>Changed files:</div>
                  {m.files.map((f) => (
                    <div key={f.path} style={{ fontFamily: "monospace", fontSize: 11 }}>
                      {f.status} {f.path}
                    </div>
                  ))}
                  <div style={{ marginTop: 4, ...muted, fontSize: 11 }}>
                    Undo: <code>git checkout -- {m.files[0].path}</code> (or <code>git restore .</code>)
                  </div>
                </>
              ) : (
                <div style={{ ...muted, marginTop: 4 }}>No file changes.</div>
              )}
            </div>
          );
        })}
        {running && <div style={{ ...muted, fontStyle: "italic" }}>Thinking…</div>}
        <div ref={endRef} />
      </div>

      <div style={{ padding: 10, borderTop: "1px solid rgba(128,128,128,0.25)" }}>
        {picked && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.5)", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontFamily: "monospace", marginBottom: 6, maxWidth: "100%" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🎯 {chipLabel(picked)}</span>
            <button onClick={() => setPicked(null)} aria-label="Clear" style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: 0 }}>
              ✕
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Describe a change… (Enter to send)"
            rows={3}
            style={{ flex: 1, resize: "none", font: "inherit", padding: 6, borderRadius: 6, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit" }}
          />
          {running ? (
            <button style={{ ...btn(), borderColor: "#ef4444", color: "#ef4444" }} onClick={stop}>
              Stop
            </button>
          ) : (
            <button style={{ ...btn(true), opacity: input.trim() ? 1 : 0.5 }} onClick={() => void send()} disabled={!input.trim()}>
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
