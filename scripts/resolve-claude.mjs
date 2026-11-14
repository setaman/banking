// Locates the Claude Code CLI across platforms. Returns { file, viaShell } or null.
// viaShell is true for Windows .cmd/.bat shims, which must be run through cmd.exe.
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const isFile = (p) => {
  try {
    return !!p && existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
};

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 8000 })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const result = (file) => ({ file, viaShell: /\.(cmd|bat)$/i.test(file) });

export function resolveClaude() {
  const env = process.env.CLAUDE_BIN;
  if (env && isFile(env)) return result(env);

  if (process.platform === "win32") {
    const home = process.env.USERPROFILE || os.homedir();
    const candidates = [
      ...run("where.exe", ["claude"]),
      path.join(home, ".local", "bin", "claude.exe"),
      process.env.APPDATA && path.join(process.env.APPDATA, "npm", "claude.cmd"),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "claude", "claude.exe"),
    ].filter(isFile);
    const pick =
      candidates.find((c) => /\.exe$/i.test(c)) ?? candidates.find((c) => /\.(cmd|bat)$/i.test(c));
    return pick ? result(pick) : null;
  }

  const home = process.env.HOME || os.homedir();
  const candidates = [
    ...run("/bin/sh", ["-lc", "command -v claude"]),
    path.join(home, ".local", "bin", "claude"),
    path.join(home, ".claude", "local", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
  ].filter(isFile);
  return candidates[0] ? result(candidates[0]) : null;
}
