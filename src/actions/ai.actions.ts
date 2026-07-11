"use server";

import { randomUUID } from "crypto";
import { generateText } from "ai";
import { z } from "zod";

import {
  AiProviderSchema,
  deleteAiProfile as deleteAiProfileFromDisk,
  deriveAiProfileName,
  getActiveAiProfile,
  getAiProfileById,
  getAiProfiles,
  maskApiKey,
  saveAiProfile as saveAiProfileToDisk,
  setActiveAiProfile as setActiveAiProfileOnDisk,
} from "@/config/ai";
import type { AiProfile, AiProvider } from "@/config/ai";
import { resolveModel } from "@/lib/ai/provider";
import { FALLBACK_MODELS, listModels } from "@/lib/ai/model-catalog";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type ActionResult = { success: boolean; error?: string };

export interface AiProfileStatus {
  id: string;
  name: string;
  provider: AiProvider;
  model: string;
  baseUrl?: string;
  keyPreview?: string;
  isActive: boolean;
}

export interface AiProfilesStatus {
  profiles: AiProfileStatus[];
  activeProfileId: string | null;
}

export interface SaveAiProfileInput {
  /** Omit to create a new profile; provide an existing id to update it. */
  id?: string;
  /** Omit to keep the existing name (update) or auto-derive one (create). */
  name?: string;
  provider: AiProvider;
  model: string;
  /** Omit on update to keep the previously saved key unchanged. */
  apiKey?: string;
  baseUrl?: string;
}

export type SaveAiProfileResult =
  | { success: true; profile: AiProfileStatus; activeProfileId: string }
  | { success: false; error: string };

export type DeleteAiProfileResult =
  | { success: true; activeProfileId: string }
  | { success: false; error: string };

export type ListAvailableModelsInput =
  | { profileId: string }
  | { draft: { provider: AiProvider; apiKey?: string; baseUrl?: string } };

export type ListAvailableModelsResult =
  | { success: true; models: string[] }
  | { success: false; error: string; fallback: string[] };

export type TestAiConnectionResult =
  | { success: true; latencyMs: number }
  | { success: false; error: string };

/** Max time to wait for a provider response before treating it as failed. */
const TEST_CONNECTION_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toProfileStatus(
  profile: AiProfile,
  activeProfileId: string | null
): AiProfileStatus {
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    model: profile.model,
    baseUrl: profile.baseUrl,
    keyPreview: profile.apiKey ? maskApiKey(profile.apiKey) : undefined,
    isActive: profile.id === activeProfileId,
  };
}

// ---------------------------------------------------------------------------
// Profile actions (v1.1)
// ---------------------------------------------------------------------------

/**
 * Returns masked status for every saved AI profile plus which one is
 * active. Safe to expose to the client — never returns raw API keys.
 */
export async function getAiProfilesStatus(): Promise<AiProfilesStatus> {
  const profiles = getAiProfiles();
  const activeProfileId = getActiveAiProfile()?.id ?? null;

  return {
    profiles: profiles.map((p) => toProfileStatus(p, activeProfileId)),
    activeProfileId,
  };
}

const SaveAiProfileInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  provider: AiProviderSchema,
  model: z.string().trim().min(1, "Model is required"),
  apiKey: z.string().trim().min(1).optional(),
  baseUrl: z.string().trim().url().optional(),
});

/**
 * Creates a new profile (no `id`, or an `id` not matching a saved profile)
 * or updates an existing one. Merge-safe: omitting `apiKey` on an update
 * keeps the previously saved key (the client never receives the real key
 * back from `getAiProfilesStatus`, so it can't round-trip it — this lets
 * the settings form save changes to the model/name/base URL without
 * forcing the user to re-paste their key every time).
 */
export async function saveAiProfile(
  input: SaveAiProfileInput
): Promise<SaveAiProfileResult> {
  const parsed = SaveAiProfileInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const data = parsed.data;
  const existing = data.id ? getAiProfileById(data.id) : null;

  const profile: AiProfile = {
    id: data.id ?? randomUUID(),
    name:
      data.name ??
      existing?.name ??
      deriveAiProfileName(data.provider, data.model),
    provider: data.provider,
    model: data.model,
    apiKey: data.apiKey ?? existing?.apiKey,
    baseUrl: data.baseUrl,
  };

  const result = saveAiProfileToDisk(profile);
  if (!result.success || !result.activeProfileId) {
    return { success: false, error: result.error ?? "Failed to save profile." };
  }

  return {
    success: true,
    profile: toProfileStatus(profile, result.activeProfileId),
    activeProfileId: result.activeProfileId,
  };
}

/**
 * Deletes a profile by id.
 *
 * Semantics: refuses to delete the last remaining profile (there must
 * always be at least one). Deleting the currently active profile
 * automatically reassigns the active profile to the first one remaining —
 * the caller should refresh via `getAiProfilesStatus` afterward to reflect
 * the new active profile in the UI.
 */
export async function deleteAiProfile(
  id: string
): Promise<DeleteAiProfileResult> {
  const parsed = z.string().trim().min(1).safeParse(id);
  if (!parsed.success) {
    return { success: false, error: "Invalid profile id." };
  }

  const result = deleteAiProfileFromDisk(parsed.data);
  if (!result.success || !result.activeProfileId) {
    return {
      success: false,
      error: result.error ?? "Failed to delete profile.",
    };
  }

  return { success: true, activeProfileId: result.activeProfileId };
}

/** Switches the active profile. Fails if `id` doesn't match a saved profile. */
export async function setActiveAiProfile(id: string): Promise<ActionResult> {
  const parsed = z.string().trim().min(1).safeParse(id);
  if (!parsed.success) {
    return { success: false, error: "Invalid profile id." };
  }

  return setActiveAiProfileOnDisk(parsed.data);
}

const DraftProfileSchema = z.object({
  provider: AiProviderSchema,
  apiKey: z.string().trim().min(1).optional(),
  baseUrl: z.string().trim().url().optional(),
});

/**
 * Lists chat-capable models for either a saved profile (`{ profileId }`) or
 * an unsaved draft (`{ draft: {...} }`) — the latter lets the settings form
 * populate the model dropdown before the profile is ever saved. Falls back
 * to a static per-provider suggestion list on any failure. Never echoes the
 * API key back to the client.
 */
export async function listAvailableModels(
  input: ListAvailableModelsInput
): Promise<ListAvailableModelsResult> {
  let provider: AiProvider;
  let profileInput: { provider: AiProvider; apiKey?: string; baseUrl?: string };

  if ("profileId" in input) {
    const profile = getAiProfileById(input.profileId);
    if (!profile) {
      return { success: false, error: "Profile not found.", fallback: [] };
    }
    provider = profile.provider;
    profileInput = profile;
  } else {
    const parsed = DraftProfileSchema.safeParse(input.draft);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
        fallback: [],
      };
    }
    provider = parsed.data.provider;
    profileInput = parsed.data;
  }

  const result = await listModels(profileInput);
  if ("models" in result) {
    return { success: true, models: result.models };
  }

  return {
    success: false,
    error: result.error,
    fallback: [...FALLBACK_MODELS[provider]],
  };
}

/**
 * Tests connectivity to the given profile (or the active one, if omitted)
 * by resolving its model and issuing a minimal `generateText` call. Returns
 * a sanitized, user-facing error message on failure — never the raw error
 * or API key.
 */
export async function testAiConnection(
  profileId?: string
): Promise<TestAiConnectionResult> {
  const profile = profileId
    ? getAiProfileById(profileId)
    : getActiveAiProfile();

  if (!profile) {
    return {
      success: false,
      error: profileId
        ? "Profile not found."
        : "No AI provider configured yet. Save a profile first.",
    };
  }

  const startedAt = Date.now();

  try {
    const model = resolveModel(profile);
    await generateText({
      model,
      prompt: "Reply with OK",
      abortSignal: AbortSignal.timeout(TEST_CONNECTION_TIMEOUT_MS),
    });

    return { success: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { success: false, error: describeAiError(error, profile.provider) };
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
function describeAiError(error: unknown, provider: AiProvider): string {
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
