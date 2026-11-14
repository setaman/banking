import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

import { btn, muted } from "./shared";

const WS_URL = "ws://127.0.0.1:6101/pty";

export interface TerminalHandle {
  /** Paste text into the PTY input as one bracketed-paste block (no Enter). */
  paste: (text: string) => void;
  focus: () => void;
}

export const TerminalView = forwardRef<TerminalHandle, { visible: boolean; hasContext: boolean; onSendFlow: () => void; onInsert: () => void; flowSelected: boolean; onConnectedChange?: (c: boolean) => void }>(
  function TerminalView({ visible, hasContext, onSendFlow, onInsert, flowSelected, onConnectedChange }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const visibleRef = useRef(visible);
    useEffect(() => {
      visibleRef.current = visible;
    });
    const [connected, setConnected] = useState(false);
    useEffect(() => {
      onConnectedChange?.(connected);
    }, [connected, onConnectedChange]);

    const send = useCallback((msg: object) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    }, []);

    const fit = useCallback(() => {
      const host = hostRef.current;
      const term = termRef.current;
      if (!host || !term || !visibleRef.current || host.clientWidth === 0 || host.clientHeight === 0) return;
      try {
        fitRef.current?.fit();
        send({ type: "resize", cols: term.cols, rows: term.rows });
      } catch {
        /* ignore */
      }
    }, [send]);

    useImperativeHandle(
      ref,
      () => ({
        paste: (text: string) => {
          send({ type: "input", data: `\x1b[200~${text}\x1b[201~` });
          termRef.current?.focus();
        },
        focus: () => termRef.current?.focus(),
      }),
      [send]
    );

    useEffect(() => {
      const term = new Terminal({
        fontSize: 12,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        cursorBlink: true,
        theme: { background: "#0b0b10", foreground: "#e5e7eb", cursor: "#a78bfa" },
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      termRef.current = term;
      fitRef.current = fitAddon;
      term.open(hostRef.current as HTMLDivElement);
      const dataSub = term.onData((data) => send({ type: "input", data }));

      let disposed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const connect = (): void => {
        if (disposed) return;
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => {
          setConnected(true);
          term.reset();
          fit();
        };
        ws.onmessage = (e) => {
          try {
            const m = JSON.parse(String(e.data));
            if (m.type === "output") term.write(m.data);
            else if (m.type === "exit") term.write(`\r\n[process exited with code ${m.exitCode}]\r\n`);
          } catch {
            /* ignore */
          }
        };
        ws.onclose = () => {
          setConnected(false);
          if (wsRef.current === ws) wsRef.current = null;
          if (!disposed) timer = setTimeout(connect, 2000);
        };
        ws.onerror = () => ws.close();
      };
      connect();

      const ro = new ResizeObserver(() => fit());
      ro.observe(hostRef.current as HTMLDivElement);

      return () => {
        disposed = true;
        clearTimeout(timer);
        ro.disconnect();
        dataSub.dispose();
        wsRef.current?.close();
        term.dispose();
      };
    }, [fit, send]);

    useEffect(() => {
      if (visible) {
        requestAnimationFrame(() => {
          fit();
          termRef.current?.focus();
        });
      }
    }, [visible, fit]);

    return (
      <div style={{ display: visible ? "flex" : "none", flexDirection: "column", height: "100%", minHeight: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderBottom: "1px solid rgba(128,128,128,0.25)", fontSize: 11 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: connected ? "#22c55e" : "#ef4444", flex: "none" }} />
          <span style={muted}>{connected ? "connected" : "terminal server not running — npm run storybook"}</span>
          <span style={{ flex: 1 }} />
          <button style={btn()} onClick={onInsert} disabled={!hasContext} title="Paste the picked element into the terminal prompt">
            Insert selection
          </button>
          <button style={btn()} onClick={onSendFlow} disabled={!flowSelected} title="Paste just the flow line">
            ↳ Send flow
          </button>
          <button style={btn()} onClick={() => send({ type: "restart" })}>
            Restart
          </button>
        </div>
        <div
          style={{ flex: 1, minHeight: 0, background: "#0b0b10", padding: 6, boxSizing: "border-box" }}
          onClick={() => termRef.current?.focus()}
        >
          <div ref={hostRef} style={{ width: "100%", height: "100%" }} />
        </div>
      </div>
    );
  }
);
