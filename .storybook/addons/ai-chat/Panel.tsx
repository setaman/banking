import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChannel } from "storybook/manager-api";
import type { API } from "storybook/manager-api";

import { ChatView } from "./ChatView";
import { ComposerView } from "./ComposerView";
import { elementKey, loadBasket, saveBasket, slimElement } from "./composer";
import type { Basket } from "./composer";
import flowsJson from "../../ai-chat/flows.json";
import { FALLBACK_FLOWS, btn, flowLine, insertionText } from "./shared";
import type { Flow, Picked } from "./shared";
import { TerminalView } from "./TerminalView";
import type { TerminalHandle } from "./TerminalView";

const SERVER = "http://127.0.0.1:6100";
const LS_MODE = "ai-chat:mode";
const LS_FLOW = "ai-chat:flow";
const LS_REQUEST = "ai-chat:request";
const STATIC_FLOWS = flowsJson as Flow[];
type Mode = "chat" | "terminal" | "composer";

const lsGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string | null): void => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

/** Thin wrapper: shared mode / flow / picked state; keeps both views mounted. */
export function Panel({ active, api }: { active: boolean; api: API }): React.ReactElement {
  const [mode, setModeState] = useState<Mode>(() => {
    const m = lsGet(LS_MODE);
    return m === "terminal" || m === "composer" ? m : "chat";
  });
  const [flowId, setFlowId] = useState<string | null>(() => lsGet(LS_FLOW));
  const [flows, setFlows] = useState<Flow[]>(FALLBACK_FLOWS);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [picking, setPicking] = useState(false);
  const [basket, setBasketState] = useState<Basket>(loadBasket);
  const [request, setRequestState] = useState<string>(() => lsGet(LS_REQUEST) ?? "");
  const [termConnected, setTermConnected] = useState(false);
  const termRef = useRef<TerminalHandle>(null);
  const setBasket = useCallback((fn: (b: Basket) => Basket) => {
    setBasketState((b) => {
      const n = fn(b);
      saveBasket(n);
      return n;
    });
  }, []);
  const setRequest = (s: string): void => {
    setRequestState(s);
    lsSet(LS_REQUEST, s);
  };
  const activeFlows = mode === "composer" ? STATIC_FLOWS : flows;
  const flowObj = activeFlows.find((f) => f.id === flowId) ?? null;
  const modeRef = useRef(mode);
  const flowObjRef = useRef<Flow | null>(null);
  useEffect(() => {
    modeRef.current = mode;
    flowObjRef.current = flowObj;
  });

  const setMode = (m: Mode): void => {
    setModeState(m);
    lsSet(LS_MODE, m);
  };
  const toggleFlow = (id: string): void => {
    const next = flowId === id ? null : id;
    setFlowId(next);
    lsSet(LS_FLOW, next);
  };

  useEffect(() => {
    fetch(`${SERVER}/flows`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((l: Flow[]) => Array.isArray(l) && l.length > 0 && setFlows(l))
      .catch(() => undefined);
  }, []);

  const insert = useCallback((p: Picked | null) => {
    if (!p) return;
    termRef.current?.paste(insertionText(p, flowObjRef.current));
  }, []);

  const emit = useChannel({
    "ai-chat/picked": (p: Picked) => {
      setPicking(false);
      if (modeRef.current === "composer") {
        const el = slimElement(p);
        setBasket((b) => (b.elements.some((x) => elementKey(x) === elementKey(el)) ? b : { ...b, elements: [...b.elements, el] }));
        api.setSelectedPanel("ai-chat/panel");
        return;
      }
      setPicked(p);
      api.setSelectedPanel("ai-chat/panel");
      if (modeRef.current === "terminal") setTimeout(() => insert(p), 50);
    },
    "ai-chat/pick-cancelled": () => setPicking(false),
  });

  const togglePick = (): void => {
    if (picking) {
      emit("ai-chat/pick-cancel");
      setPicking(false);
    } else {
      emit("ai-chat/pick-start");
      setPicking(true);
    }
  };

  const seg = (m: Mode, label: string): React.ReactElement => (
    <button style={{ ...btn(mode === m), borderRadius: 0 }} onClick={() => setMode(m)}>
      {label}
    </button>
  );

  return (
    <div style={{ display: active ? "flex" : "none", flexDirection: "column", height: "100%", boxSizing: "border-box", fontSize: 13, color: "inherit" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(128,128,128,0.25)" }}>
        <div style={{ display: "inline-flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(128,128,128,0.4)" }}>
          {seg("chat", "💬 Chat")}
          {seg("terminal", "⌨️ Terminal")}
          {seg("composer", "🧩 Composer")}
        </div>
        <span style={{ flex: 1 }} />
        <button style={btn(picking)} onClick={togglePick} title="Click an element in the preview">
          🎯 Pick element
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 12px", borderBottom: "1px solid rgba(128,128,128,0.25)" }}>
        {activeFlows.map((f) => (
          <button
            key={f.id}
            title={f.instructions}
            aria-pressed={flowId === f.id}
            onClick={() => toggleFlow(f.id)}
            style={{ ...btn(flowId === f.id), borderRadius: 999, padding: "2px 10px", fontSize: 11 }}
          >
            {f.emoji} {f.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <ChatView visible={mode === "chat"} picked={picked} setPicked={setPicked} flow={flowId} />
        {mode === "composer" && (
          <ComposerView
            flow={flowObj}
            basket={basket}
            setBasket={setBasket}
            request={request}
            setRequest={setRequest}
            termConnected={termConnected}
            onSendToTerminal={(text) => {
              setMode("terminal");
              setTimeout(() => termRef.current?.paste(text), 100);
            }}
          />
        )}
        <TerminalView
          ref={termRef}
          visible={mode === "terminal" && active}
          onConnectedChange={setTermConnected}
          hasContext={!!picked}
          flowSelected={!!flowObj}
          onInsert={() => insert(picked)}
          onSendFlow={() => {
            if (flowObj) termRef.current?.paste(flowLine(flowObj));
          }}
        />
      </div>
    </div>
  );
}
