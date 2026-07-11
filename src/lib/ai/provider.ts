import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { createOllama } from "ollama-ai-provider-v2";

import type { AiProfile } from "@/config/ai";
import { ollamaApiBaseUrl } from "@/lib/ai/ollama-base-url";

/**
 * Resolves a provider-agnostic `AiProfile` into a concrete Vercel AI SDK
 * `LanguageModel` instance. Server-only — must never be imported from a
 * client component (API keys are read from the profile and passed directly
 * to the provider factory).
 */
export function resolveModel(profile: AiProfile): LanguageModel {
  switch (profile.provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: profile.apiKey,
        baseURL: profile.baseUrl,
      });
      return openai(profile.model);
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: profile.apiKey,
      });
      return anthropic(profile.model);
    }
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: profile.apiKey,
      });
      return google(profile.model);
    }
    case "ollama": {
      // `profile.baseUrl` is stored as the bare server root (the same value
      // the model catalog uses to build `{root}/api/tags`) — normalize it to
      // the `{root}/api` form this provider's `baseURL` expects. See
      // `ollamaApiBaseUrl`'s doc for why the bare root would 404 here.
      const ollama = createOllama({
        baseURL: ollamaApiBaseUrl(profile.baseUrl),
      });
      return ollama(profile.model);
    }
  }
}
