import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { createOllama } from "ollama-ai-provider-v2";

import type { AiConfig } from "@/config/ai";

export const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434";

/**
 * Resolves a provider-agnostic `AiConfig` into a concrete Vercel AI SDK
 * `LanguageModel` instance. Server-only — must never be imported from a
 * client component (API keys are read from the config and passed directly
 * to the provider factory).
 */
export function resolveModel(config: AiConfig): LanguageModel {
  switch (config.provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      return openai(config.model);
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
      });
      return anthropic(config.model);
    }
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: config.apiKey,
      });
      return google(config.model);
    }
    case "ollama": {
      const ollama = createOllama({
        baseURL: config.baseUrl ?? OLLAMA_DEFAULT_BASE_URL,
      });
      return ollama(config.model);
    }
  }
}
