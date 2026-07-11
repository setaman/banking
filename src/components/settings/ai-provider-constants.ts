import { Bot, HardDrive, Sparkles, Zap, type LucideIcon } from "lucide-react";

import type { AiProvider } from "@/config/ai";

// ---------------------------------------------------------------------------
// Shared, client-safe provider metadata used across the profile manager
// (list + form + model combobox). Deliberately duplicated (not imported)
// from `@/config/ai`'s server-only `PROVIDER_LABELS` — that module pulls in
// `fs`/`crypto` at module scope and must never be imported (even for a
// single constant) from a "use client" component.
// ---------------------------------------------------------------------------

export const PROVIDER_LABELS: Readonly<Record<AiProvider, string>> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  ollama: "Ollama",
};

export const PROVIDER_ICONS: Readonly<Record<AiProvider, LucideIcon>> = {
  openai: Sparkles,
  anthropic: Bot,
  google: Zap,
  ollama: HardDrive,
};

export const PROVIDER_OPTIONS: ReadonlyArray<{
  value: AiProvider;
  label: string;
}> = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google (Gemini)" },
  { value: "ollama", label: "Ollama (local)" },
];

export const MODEL_PLACEHOLDER: Readonly<Record<AiProvider, string>> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.5-flash",
  ollama: "llama3.2",
};

export const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434";

/** Client-safe preview of the name the server would auto-derive if left blank. */
export function previewProfileName(
  provider: AiProvider,
  model: string
): string {
  return `${PROVIDER_LABELS[provider]} — ${model.trim() || "model"}`;
}
