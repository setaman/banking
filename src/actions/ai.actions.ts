"use server";

import { generateText } from "ai";

import {
  AiConfigSchema,
  getAiConfig,
  maskApiKey,
  saveAiConfig as saveAiConfigToDisk,
} from "@/config/ai";
import type { AiConfig } from "@/config/ai";
import { resolveModel } from "@/lib/ai/provider";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface AiConfigStatus {
  configured: boolean;
  provider?: string;
  model?: string;
  keyPreview?: string;
}

export type ActionResult = { success: boolean; error?: string };

export type TestAiConnectionResult =
  | { success: true; latencyMs: number }
  | { success: false; error: string };

/** Max time to wait for a provider response before treating it as failed. */
const TEST_CONNECTION_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Returns masked AI configuration status. Safe to expose to the client —
 * never returns the raw API key.
 */
export async function getAiConfigStatus(): Promise<AiConfigStatus> {
  const config = getAiConfig();

  if (!config) {
    return { configured: false };
  }

  return {
    configured: true,
    provider: config.provider,
    model: config.model,
    keyPreview: config.apiKey ? maskApiKey(config.apiKey) : undefined,
  };
}

/**
 * Validates and persists the AI provider configuration. Merges with (and
 * preserves) existing bank credentials stored in banking.config.json. Never
 * logs the API key.
 */
export async function saveAiConfig(input: AiConfig): Promise<ActionResult> {
  const parsed = AiConfigSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  return saveAiConfigToDisk(parsed.data);
}

/**
 * Tests connectivity to the currently saved AI provider by resolving the
 * configured model and issuing a minimal `generateText` call. Returns a
 * sanitized, user-facing error message on failure — never the raw error or
 * API key.
 */
export async function testAiConnection(): Promise<TestAiConnectionResult> {
  const config = getAiConfig();

  if (!config) {
    return {
      success: false,
      error: "No AI provider configured yet. Save a configuration first.",
    };
  }

  const startedAt = Date.now();

  try {
    const model = resolveModel(config);
    await generateText({
      model,
      prompt: "Reply with OK",
      abortSignal: AbortSignal.timeout(TEST_CONNECTION_TIMEOUT_MS),
    });

    return { success: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { success: false, error: describeAiError(error, config.provider) };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Maps a raw provider/network error into a sanitized, actionable message.
 * Never includes the raw error object (which may embed request headers or
 * other sensitive details) in the returned string.
 */
function describeAiError(
  error: unknown,
  provider: AiConfig["provider"]
): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  // Ollama-specific: server not running / model not pulled
  if (provider === "ollama") {
    if (
      lower.includes("econnrefused") ||
      lower.includes("fetch failed") ||
      lower.includes("failed to fetch")
    ) {
      return "Could not reach Ollama. Make sure it's running (`ollama serve`) and the model is pulled (`ollama pull <model>`).";
    }
    if (lower.includes("not found") || lower.includes("404")) {
      return "Model not found on your Ollama server. Pull it first with `ollama pull <model>`.";
    }
  }

  // Auth errors (401/403 or key-related wording)
  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key") ||
    lower.includes("incorrect api key") ||
    lower.includes("authentication")
  ) {
    return "Authentication failed. Check that your API key is correct and active.";
  }

  // Network errors
  if (
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("timeout") ||
    lower.includes("network")
  ) {
    return "Could not reach the AI provider. Check your internet connection and base URL.";
  }

  // Rate limiting
  if (lower.includes("429") || lower.includes("rate limit")) {
    return "Rate limited by the provider. Please wait a moment and try again.";
  }

  return "Connection test failed. Check your provider, model, and API key.";
}
