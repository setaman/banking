// Bridges a Storybook chat panel to the local Claude Code CLI (SSE over HTTP).
import http from "node:http";
import { spawn, execFile } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.AI_CHAT_PORT || 6100);
let child = null;

const cors = (req, res) => {
  const o = req.headers.origin;
  if (o && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
};
const json = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(b || "{}"));
      } catch {
        resolve(null);
      }
    });
  });
const git = (args) =>
  new Promise((resolve) =>
    execFile("git", args, { cwd: ROOT }, (_e, out) => resolve(out || ""))
  );

function buildPrompt(message, c) {
  if (!c) return message;
  const cut = (s, n) => (s && s.length > n ? s.slice(0, n) + "…" : s);
  const L = [`The user selected an element in Storybook story ${c.storyId ?? "?"}.`];
  L.push(
    `Component: ${c.componentName ?? "?"}` +
      (c.componentStack?.length ? ` (stack: ${c.componentStack.join(" > ")})` : "")
  );
  L.push(
    `DOM element: ${c.tagName ?? "?"}` +
      (c.source ? ` written at ${c.source.file}:${c.source.line}:${c.source.column}` : "")
  );
  if (c.args) L.push(`Story args: ${cut(JSON.stringify(c.args), 2000)}`);
  if (c.className) L.push(`Classes: ${c.className}`);
  if (c.computedStyles) L.push(`Computed styles: ${cut(JSON.stringify(c.computedStyles), 1500)}`);
  if (c.text) L.push(`Text: ${cut(c.text, 300)}`);
  if (c.outerHTML) L.push(`HTML (truncated): ${cut(c.outerHTML, 1500)}`);
  return `${L.join("\n")}\n\nUser request:\n${message}`;
}

const summarize = (i = {}) =>
  String(i.file_path ?? i.pattern ?? i.command ?? i.path ?? "").slice(0, 120);

async function chat(req, res) {
  const body = await readBody(req);
  if (!body || typeof body.message !== "string" || !body.message.trim())
    return json(res, 400, { error: "message required" });
  if (body.model != null && body.model !== "" && (typeof body.model !== "string" || !/^[a-zA-Z0-9.\-_\[\]]{1,64}$/.test(body.model)))
    return json(res, 400, { error: "invalid model" });
  if (child) return json(res, 409, { error: "busy" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (o) => !res.writableEnded && res.write(`data: ${JSON.stringify(o)}\n\n`);

  const rulesPath = path.join(ROOT, ".storybook/ai-chat/AGENT_RULES.md");
  const args = [
    "-p", buildPrompt(body.message, body.context),
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "acceptEdits",
    "--allowedTools", "Read", "Edit", "MultiEdit", "Write", "Glob", "Grep",
    "Bash(git diff:*)", "Bash(git status:*)", "Bash(ls:*)",
  ];
  if (existsSync(rulesPath))
    args.push("--append-system-prompt", readFileSync(rulesPath, "utf8"));
  if (body.sessionId) args.push("--resume", body.sessionId);
  if (body.model) args.push("--model", body.model);

  const p = spawn("claude", args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  child = p;
  let err = "";
  let buf = "";
  let gotResult = false;
  let spawnFailed = false;

  const handle = (line) => {
    let m;
    try {
      m = JSON.parse(line);
    } catch {
      return;
    }
    if (m.type === "system" && m.subtype === "init") send({ type: "session", sessionId: m.session_id, model: m.model });
    else if (m.type === "assistant") {
      for (const b of m.message?.content ?? []) {
        if (b.type === "text" && b.text) send({ type: "text", text: b.text });
        else if (b.type === "tool_use") send({ type: "tool", name: b.name, summary: summarize(b.input) });
      }
    } else if (m.type === "result") {
      gotResult = true;
      send({
        type: "result",
        ok: !m.is_error && m.subtype === "success",
        durationMs: m.duration_ms,
        costUsd: m.total_cost_usd ?? m.cost_usd,
        text: m.result,
      });
    }
  };

  p.stdout.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const l = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (l) handle(l);
    }
  });
  p.stderr.on("data", (d) => (err += d));
  p.on("error", (e) => {
    spawnFailed = true;
    send({ type: "error", message: `Failed to start claude: ${e.message}` });
  });
  res.on("close", () => {
    if (child === p) p.kill("SIGTERM");
  });

  p.on("close", async (code, sig) => {
    if (buf.trim()) handle(buf.trim());
    if (!spawnFailed && (code !== 0 || (!gotResult && err.trim())))
      send({ type: "error", message: err.trim() || `claude exited with ${sig ?? code}` });
    const [st, diffStat] = await Promise.all([git(["status", "--porcelain"]), git(["diff", "--stat"])]);
    const files = st
      .split("\n")
      .filter(Boolean)
      .map((l) => ({ status: l.slice(0, 2).trim(), path: l.slice(3) }));
    send({ type: "changes", files, diffStat: diffStat.trim() });
    send({ type: "done" });
    child = null;
    res.end();
  });
}

http
  .createServer(async (req, res) => {
    cors(req, res);
    const url = (req.url || "").split("?")[0];
    console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${url}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    if (req.method === "GET" && url === "/health") return json(res, 200, { ok: true, busy: !!child });
    if (req.method === "GET" && url === "/models")
      return json(res, 200, [
        { id: "", label: "Default (your Claude Code setting)" },
        { id: "opus", label: "Opus" },
        { id: "sonnet", label: "Sonnet" },
        { id: "haiku", label: "Haiku" },
      ]);
    if (req.method === "POST" && url === "/chat") return chat(req, res);
    if (req.method === "POST" && url === "/stop") {
      const stopped = !!child;
      child?.kill("SIGTERM");
      return json(res, 200, { stopped });
    }
    json(res, 404, { error: "not found" });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`ai-chat server on http://127.0.0.1:${PORT} (root ${ROOT})`));
