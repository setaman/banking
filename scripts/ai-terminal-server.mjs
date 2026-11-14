// PTY bridge: exposes a real interactive `claude` session to the Storybook panel (xterm.js) over WebSocket.
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { WebSocketServer } from "ws";
import * as pty from "node-pty";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.AI_TERMINAL_PORT || 6101);
const ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MAX_BUF = 300 * 1024;

let term = null;
let buffer = "";
const clients = new Set();

const clamp = (n, lo, hi, d) => (Number.isFinite(+n) ? Math.min(hi, Math.max(lo, Math.round(+n))) : d);
const broadcast = (o) => {
  const s = JSON.stringify(o);
  for (const c of clients) if (c.readyState === 1) c.send(s);
};

function spawnPty() {
  const rulesPath = path.join(ROOT, ".storybook/ai-chat/TERMINAL_RULES.md");
  const args = [];
  if (existsSync(rulesPath)) args.push("--append-system-prompt", readFileSync(rulesPath, "utf8"));
  if (process.env.AI_TERMINAL_MODEL) args.push("--model", process.env.AI_TERMINAL_MODEL);
  const cmd = process.platform === "win32" ? "claude.cmd" : "claude";
  let p;
  try {
    p = pty.spawn(cmd, args, {
      name: "xterm-256color",
      cols: 100,
      rows: 30,
      cwd: ROOT,
      env: { ...process.env, FORCE_COLOR: "1" },
    });
  } catch (e) {
    const msg = `\r\nFailed to start claude: ${e.message}\r\n`;
    buffer += msg;
    broadcast({ type: "output", data: msg });
    broadcast({ type: "exit", exitCode: -1 });
    return null;
  }
  p.onData((data) => {
    buffer += data;
    if (buffer.length > MAX_BUF) buffer = buffer.slice(-MAX_BUF);
    broadcast({ type: "output", data });
  });
  p.onExit(({ exitCode }) => {
    if (term === p) term = null;
    broadcast({ type: "exit", exitCode });
    broadcast({ type: "status", running: false });
  });
  broadcast({ type: "status", running: true });
  return p;
}

const ensure = () => term ?? (term = spawnPty());

function killPty() {
  const p = term;
  term = null;
  try {
    p?.kill();
  } catch {}
}

const server = http.createServer((req, res) => {
  const url = (req.url || "").split("?")[0];
  if (req.method === "GET" && url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, running: !!term }));
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = (req.url || "").split("?")[0];
  const origin = req.headers.origin;
  if (url !== "/pty" || !origin || !ORIGIN_RE.test(origin)) {
    console.warn(`REJECTED upgrade: path=${url} origin=${origin ?? "(none)"} from=${req.socket.remoteAddress}`);
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
    ensure();
    ws.send(JSON.stringify({ type: "status", running: !!term }));
    if (buffer) ws.send(JSON.stringify({ type: "output", data: buffer }));
    ws.on("message", (raw) => {
      let m;
      try {
        m = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (m.type === "input" && typeof m.data === "string") {
        ensure()?.write(m.data);
      } else if (m.type === "resize") {
        try {
          term?.resize(clamp(m.cols, 20, 400, 100), clamp(m.rows, 5, 200, 30));
        } catch {}
      } else if (m.type === "restart") {
        killPty();
        buffer = "";
        broadcast({ type: "output", data: "\x1bc" });
        ensure();
      }
    });
  });
});

const shutdown = () => {
  killPty();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, "127.0.0.1", () => console.log(`ai-terminal server on ws://127.0.0.1:${PORT}/pty (root ${ROOT})`));
