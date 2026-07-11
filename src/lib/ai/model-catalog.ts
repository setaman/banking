import type { AiProfile, AiProvider } from "@/config/ai";
import { normalizeOllamaBaseUrl } from "@/lib/ai/ollama-base-url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelCatalogSuccess {
  models: string[];
}

export interface ModelCatalogError {
  error: string;
}

export type ModelCatalogResult = ModelCatalogSuccess | ModelCatalogError;

/**
 * The subset of `AiProfile` needed to list models: a saved profile's id/name
 * aren't relevant here, and the settings form needs to call this with an
 * unsaved draft (provider + apiKey/baseUrl only).
 */
export type ModelCatalogInput = Pick<AiProfile, "provider"> &
  Partial<Pick<AiProfile, "apiKey" | "baseUrl">>;

const REQUEST_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Static fallback suggestions
//
// Shown by the settings UI when `listModels` fails (no key yet, provider
// unreachable, etc.) so the model field always has reasonable suggestions
// to pick from instead of being empty. Hand-maintained, not fetched.
// ---------------------------------------------------------------------------

export const FALLBACK_MODELS: Readonly<Record<AiProvider, readonly string[]>> =
  {
    openai: ["gpt-5.1", "gpt-4.1", "gpt-4o", "gpt-4o-mini", "o4-mini"],
    anthropic: [
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
      "claude-3-5-sonnet-latest",
    ],
    google: [
      "gemini-3-pro",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ],
    ollama: ["llama3.2", "llama3.1", "mistral", "qwen2.5"],
  };

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Lists the chat-capable models available to `profile`, by calling that
 * provider's OWN models endpoint directly (never a third-party aggregator) —
 * so the user's key is only ever sent to the provider they chose. Server-only.
 *
 * Never throws: every failure mode (missing key, network error, timeout,
 * non-2xx response) resolves to `{ error: string }`. Never logs the API key.
 */
export async function listModels(
  profile: ModelCatalogInput
): Promise<ModelCatalogResult> {
  try {
    switch (profile.provider) {
      case "openai":
        return await listOpenAiModels(profile);
      case "anthropic":
        return await listAnthropicModels(profile);
      case "google":
        return await listGoogleModels(profile);
      case "ollama":
        return await listOllamaModels(profile);
    }
  } catch (error) {
    return { error: describeCatalogError(error, profile.provider) };
  }
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

async function listOpenAiModels(
  profile: ModelCatalogInput
): Promise<ModelCatalogResult> {
  if (!profile.apiKey) {
    return { error: "An API key is required to list OpenAI models." };
  }

  // `resolveModel`'s `createOpenAI({ baseURL: profile.baseUrl })` (see
  // `src/lib/ai/provider.ts`) treats a configured `baseUrl` as the
  // already-versioned API root — its own default is
  // `https://api.openai.com/v1`, and it never appends a `/v1` segment
  // itself. Model listing must build its URL the same way (trim a trailing
  // slash, then append `/models` directly) so an OpenAI-compatible base URL
  // that already includes its own version segment — e.g. Groq's
  // `https://api.groq.com/openai/v1` — doesn't get a doubled `/v1/v1/models`.
  const trimmedBaseUrl = profile.baseUrl?.trim().replace(/\/+$/, "");
  const baseUrl = trimmedBaseUrl || "https://api.openai.com/v1";

  const response = await fetchWithTimeout(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${profile.apiKey}` },
  });

  if (!response.ok) {
    return { error: describeHttpError(response.status) };
  }

  const body = (await response.json()) as {
    data?: { id?: unknown; created?: unknown }[];
  };

  const NON_CHAT_PATTERN =
    /embedding|whisper|tts|dall-e|davinci|babbage|moderation|realtime|transcribe|audio|image/i;

  const models = (body.data ?? [])
    .filter(
      (m): m is { id: string; created?: number } => typeof m.id === "string"
    )
    .filter((m) => !NON_CHAT_PATTERN.test(m.id))
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .map((m) => m.id);

  return { models };
}

async function listAnthropicModels(
  profile: ModelCatalogInput
): Promise<ModelCatalogResult> {
  if (!profile.apiKey) {
    return { error: "An API key is required to list Anthropic models." };
  }

  const response = await fetchWithTimeout(
    "https://api.anthropic.com/v1/models",
    {
      headers: {
        "x-api-key": profile.apiKey,
        "anthropic-version": "2023-06-01",
      },
    }
  );

  if (!response.ok) {
    return { error: describeHttpError(response.status) };
  }

  const body = (await response.json()) as {
    data?: { id?: unknown; created_at?: unknown }[];
  };

  const models = (body.data ?? [])
    .filter(
      (m): m is { id: string; created_at?: string } => typeof m.id === "string"
    )
    .sort((a, b) => {
      const aTime = a.created_at ? Date.parse(a.created_at) : 0;
      const bTime = b.created_at ? Date.parse(b.created_at) : 0;
      return bTime - aTime;
    })
    .map((m) => m.id);

  return { models };
}

async function listGoogleModels(
  profile: ModelCatalogInput
): Promise<ModelCatalogResult> {
  if (!profile.apiKey) {
    return { error: "An API key is required to list Google models." };
  }

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(profile.apiKey)}`
  );

  if (!response.ok) {
    return { error: describeHttpError(response.status) };
  }

  const body = (await response.json()) as {
    models?: {
      name?: unknown;
      supportedGenerationMethods?: unknown;
    }[];
  };

  const models = (body.models ?? [])
    .filter(
      (
        m
      ): m is {
        name: string;
        supportedGenerationMethods?: string[];
      } => typeof m.name === "string"
    )
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    // The Vercel AI SDK's Google provider (`google(modelId)`) auto-prepends
    // "models/" to any bare id (see `getModelPath` in `@ai-sdk/google`), so
    // storing the bare id here matches the app's existing convention (the
    // settings card's placeholder is also a bare id, e.g. "gemini-2.5-flash").
    .map((m) => m.name.replace(/^models\//, ""))
    // `generateContent` support alone isn't a reliable "this is a chat
    // model" signal on this endpoint — confirmed empirically: Google's
    // image/video/music generation previews (e.g. "nano-banana-pro-preview",
    // "lyria-3-pro-preview") also declare it. Restrict to the actual chat
    // family this app's provider (`@ai-sdk/google`) targets.
    .filter((id) => /^gemini/i.test(id))
    // The API has no created/version timestamp; a descending name sort is a
    // reasonable heuristic for "newest-ish first" since model ids embed
    // ascending version numbers (gemini-2.5-... sorts after gemini-1.5-...).
    .sort((a, b) => b.localeCompare(a));

  return { models };
}

async function listOllamaModels(
  profile: ModelCatalogInput
): Promise<ModelCatalogResult> {
  // Shares `normalizeOllamaBaseUrl` with `resolveModel` (see
  // `src/lib/ai/provider.ts`) so the SAME stored `baseUrl` resolves to a
  // consistent server root for both the catalog and chat paths — the
  // catalog appends `/api/tags` directly onto the root, while the chat
  // provider needs `{root}/api` as its own `baseURL` (it appends bare paths
  // like `/chat` itself). Kept in one place so a bare host and a
  // `.../api`-suffixed host the user might paste both normalize the same
  // way in both places.
  const baseUrl = normalizeOllamaBaseUrl(profile.baseUrl);

  const response = await fetchWithTimeout(`${baseUrl}/api/tags`);

  if (!response.ok) {
    return { error: describeHttpError(response.status) };
  }

  const body = (await response.json()) as {
    models?: { name?: unknown; modified_at?: unknown }[];
  };

  const models = (body.models ?? [])
    .filter(
      (m): m is { name: string; modified_at?: string } =>
        typeof m.name === "string"
    )
    .sort((a, b) => {
      const aTime = a.modified_at ? Date.parse(a.modified_at) : 0;
      const bTime = b.modified_at ? Date.parse(b.modified_at) : 0;
      return bTime - aTime;
    })
    .map((m) => m.name);

  return { models };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function describeHttpError(status: number): string {
  if (status === 401 || status === 403) {
    return "Authentication failed. Check that your API key is correct and active.";
  }
  if (status === 404) {
    return "Models endpoint not found. Check the base URL.";
  }
  if (status === 429) {
    return "Rate limited by the provider. Please wait a moment and try again.";
  }
  return `The provider returned an unexpected response (HTTP ${status}).`;
}

/**
 * Maps a raw fetch/network error into a sanitized, actionable message. Never
 * includes the raw error object (which may embed request headers or other
 * sensitive details) in the returned string.
 */
function describeCatalogError(error: unknown, provider: AiProvider): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return "The request timed out. Check your connection and try again.";
  }

  if (
    provider === "ollama" &&
    (lower.includes("econnrefused") || lower.includes("fetch failed"))
  ) {
    return "Could not reach Ollama. Make sure it's running (`ollama serve`) at the configured base URL.";
  }

  if (
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network")
  ) {
    return "Could not reach the AI provider. Check your internet connection and base URL.";
  }

  return "Could not list available models. Check your provider, base URL, and API key.";
}
