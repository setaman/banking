import { createHash } from "crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

// NOTE: This module intentionally defines its own CONFIG_PATH (identical
// value to `@/config/credentials`'s `CONFIG_PATH`) rather than importing it,
// to avoid a circular import: `@/config/credentials` imports from this
// module to extend its own top-level config schema.
const CONFIG_PATH = join(process.cwd(), "banking.config.json");

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const AiProviderSchema = z.enum([
  "openai",
  "anthropic",
  "google",
  "ollama",
]);

export type AiProvider = z.infer<typeof AiProviderSchema>;

/**
 * A single named AI provider connection. v1.1 supports multiple profiles
 * (e.g. "Work OpenAI", "Home Ollama") saved side by side, one of which is
 * marked active at any time.
 */
export const AiProfileSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  provider: AiProviderSchema,
  model: z.string().trim().min(1, "Model is required"),
  apiKey: z.string().trim().min(1).optional(),
  baseUrl: z.string().trim().url().optional(),
});

export type AiProfile = z.infer<typeof AiProfileSchema>;

/**
 * Current (v1.1+) shape of the `ai` key in banking.config.json: a list of
 * profiles plus the id of the one currently in use.
 */
export const AiConfigSchema = z.object({
  profiles: z
    .array(AiProfileSchema)
    .min(1, "At least one AI profile is required"),
  activeProfileId: z.string().trim().min(1),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;

/**
 * Pre-v1.1 single-profile shape of the `ai` key. Recognized only so
 * `readAiConfig` can transparently migrate an existing config on read; never
 * written back to disk once any mutation (`saveAiProfile`, `deleteAiProfile`,
 * `setActiveAiProfile`) has run, since every write persists the current
 * `AiConfigSchema` shape.
 */
const LegacyAiConfigSchema = z.object({
  provider: AiProviderSchema,
  model: z.string().trim().min(1, "Model is required"),
  apiKey: z.string().trim().min(1).optional(),
  baseUrl: z.string().trim().url().optional(),
});

type LegacyAiConfig = z.infer<typeof LegacyAiConfigSchema>;

/**
 * Loose variant of the on-disk config used for both read and write paths.
 * The `ai` key is intentionally left unvalidated here: if it's corrupted,
 * hand-edited, or in the pre-v1.1 single-profile shape, this schema still
 * parses successfully (as long as the file is a JSON object), so sibling
 * keys (`dkb`, `deutscheBank`) are always preserved regardless of the `ai`
 * key's shape/validity. Actual validation/migration of the `ai` value
 * happens afterwards, in `readAiConfig`.
 */
const LooseConfigFileSchema = z
  .object({
    ai: z.unknown().optional(),
  })
  .catchall(z.unknown());

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  ollama: "Ollama",
};

/** Builds a human-friendly default profile name, e.g. "Google — gemini-2.5-flash". */
export function deriveAiProfileName(
  provider: AiProvider,
  model: string
): string {
  return `${PROVIDER_LABELS[provider]} — ${model}`;
}

/**
 * Deterministically derives a stable id for a migrated legacy profile from
 * its content (provider/model/apiKey/baseUrl). Migration is re-run in
 * memory on *every* read until the config is actually persisted (mutations
 * are the only thing that writes to disk) — a random id here would change
 * on every single read, breaking any caller that reads a profile's id in
 * one call and passes it to a mutation (`setActiveAiProfile`, etc.) in the
 * next, since that mutation re-migrates the still-unpersisted legacy config
 * and would generate a different random id. Hashing the content instead
 * guarantees the same legacy input always migrates to the same id, so ids
 * stay stable across calls even before the first save.
 */
function deriveLegacyProfileId(legacy: LegacyAiConfig): string {
  const fingerprint = JSON.stringify([
    legacy.provider,
    legacy.model,
    legacy.apiKey ?? null,
    legacy.baseUrl ?? null,
  ]);
  return `legacy-${createHash("sha256").update(fingerprint).digest("hex").slice(0, 24)}`;
}

/**
 * Converts a pre-v1.1 single-profile config into a single-profile
 * `AiConfig`, preserving every field (provider, model, apiKey, baseUrl)
 * exactly. The new profile is marked active.
 */
function migrateLegacyConfig(legacy: LegacyAiConfig): AiConfig {
  const profile: AiProfile = {
    id: deriveLegacyProfileId(legacy),
    name: deriveAiProfileName(legacy.provider, legacy.model),
    provider: legacy.provider,
    model: legacy.model,
    apiKey: legacy.apiKey,
    baseUrl: legacy.baseUrl,
  };

  return { profiles: [profile], activeProfileId: profile.id };
}

// ---------------------------------------------------------------------------
// Internal read/write helpers
// ---------------------------------------------------------------------------

/**
 * Reads and normalizes the `ai` key from banking.config.json into the
 * current multi-profile shape, transparently migrating the pre-v1.1
 * single-profile shape in memory. Returns null if the file/key is missing,
 * unreadable, or fails to match either shape.
 *
 * Never writes to disk — this is a pure read. The migrated shape is only
 * persisted the next time a mutation (`saveAiProfile`, `deleteAiProfile`,
 * `setActiveAiProfile`) runs, since those always write out the full,
 * current-shape `AiConfig`.
 */
function readAiConfig(): AiConfig | null {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }

  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = LooseConfigFileSchema.safeParse(JSON.parse(raw));

    if (!parsed.success || parsed.data.ai === undefined) {
      return null;
    }

    const current = AiConfigSchema.safeParse(parsed.data.ai);
    if (current.success) {
      return current.data;
    }

    const legacy = LegacyAiConfigSchema.safeParse(parsed.data.ai);
    if (legacy.success) {
      return migrateLegacyConfig(legacy.data);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validates and persists the full `ai` key (current multi-profile shape) in
 * banking.config.json. Merges with (and preserves) all existing sibling
 * keys such as `dkb`/`deutscheBank`. Writes atomically via a temp file
 * rename. Never logs API keys.
 */
function writeAiConfig(config: AiConfig): { success: boolean; error?: string } {
  const validation = AiConfigSchema.safeParse(config);

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    // Read existing config or start with empty object; unknown keys are
    // preserved verbatim via `.catchall(z.unknown())`.
    let existing: Record<string, unknown> = {};
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const parsed = LooseConfigFileSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        existing = parsed.data;
      }
    }

    const updated = {
      ...existing,
      ai: validation.data,
    };

    const tmpPath = CONFIG_PATH + ".tmp";
    writeFileSync(tmpPath, JSON.stringify(updated, null, 2), "utf-8");
    renameSync(tmpPath, CONFIG_PATH);

    return { success: true };
  } catch {
    // Do not leak filesystem paths or secret values in the error message
    return {
      success: false,
      error: "Failed to save AI configuration. Check file system permissions.",
    };
  }
}

// ---------------------------------------------------------------------------
// Public read helpers
// ---------------------------------------------------------------------------

/** Returns every saved AI profile (empty array if none configured yet). */
export function getAiProfiles(): AiProfile[] {
  return readAiConfig()?.profiles ?? [];
}

/**
 * Returns the profile the app should use right now: the one matching
 * `activeProfileId`, falling back to the first saved profile if the active
 * id is somehow stale (e.g. hand-edited config), or null if none exist.
 * This is what `src/app/api/chat/route.ts` calls to resolve the model.
 */
export function getActiveAiProfile(): AiProfile | null {
  const config = readAiConfig();
  if (!config) {
    return null;
  }
  return (
    config.profiles.find((p) => p.id === config.activeProfileId) ??
    config.profiles[0] ??
    null
  );
}

/** Returns the raw `activeProfileId` on disk, or null if unconfigured. */
export function getActiveAiProfileId(): string | null {
  return readAiConfig()?.activeProfileId ?? null;
}

/** Returns a single profile by id, or null if not found/unconfigured. */
export function getAiProfileById(id: string): AiProfile | null {
  return readAiConfig()?.profiles.find((p) => p.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface SaveAiProfileDiskResult {
  success: boolean;
  error?: string;
  /** The active profile id after the save (unchanged unless this was the first profile ever saved). */
  activeProfileId?: string;
}

/**
 * Creates (if `profile.id` is new) or updates (if it matches an existing
 * profile) a single AI profile, then persists the full profile list.
 *
 * - If this is the very first profile ever saved, it becomes active.
 * - Otherwise the existing `activeProfileId` is preserved as-is (saving/
 *   editing a non-active profile does not switch to it — use
 *   `setActiveAiProfile` for that).
 */
export function saveAiProfile(profile: AiProfile): SaveAiProfileDiskResult {
  const validation = AiProfileSchema.safeParse(profile);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues.map((i) => i.message).join(", "),
    };
  }

  const validated = validation.data;
  const current = readAiConfig();
  const existingProfiles = current?.profiles ?? [];

  const index = existingProfiles.findIndex((p) => p.id === validated.id);
  const profiles =
    index >= 0
      ? existingProfiles.map((p, i) => (i === index ? validated : p))
      : [...existingProfiles, validated];

  const activeProfileId =
    current && current.profiles.some((p) => p.id === current.activeProfileId)
      ? current.activeProfileId
      : validated.id;

  const result = writeAiConfig({ profiles, activeProfileId });
  return result.success
    ? { success: true, activeProfileId }
    : { success: false, error: result.error };
}

export interface DeleteAiProfileResult {
  success: boolean;
  error?: string;
  /** The active profile id after the delete, if it had to be reassigned. */
  activeProfileId?: string;
}

/**
 * Deletes a profile by id.
 *
 * Semantics (deliberately simple, no confirmation dialog at this layer):
 * - Refuses to delete the last remaining profile — there must always be at
 *   least one, so the assistant always has something to fall back to.
 * - Deleting the currently active profile automatically reassigns
 *   `activeProfileId` to the first remaining profile (arbitrary but
 *   deterministic — avoids ever landing in a state with no active
 *   profile). The caller (settings UI) is expected to surface the new
 *   active profile afterward via `getAiProfilesStatus`.
 */
export function deleteAiProfile(id: string): DeleteAiProfileResult {
  const current = readAiConfig();
  if (!current) {
    return { success: false, error: "No AI profiles configured." };
  }

  if (current.profiles.length <= 1) {
    return {
      success: false,
      error:
        "Cannot delete the only remaining AI profile. Add another profile first.",
    };
  }

  const profiles = current.profiles.filter((p) => p.id !== id);
  if (profiles.length === current.profiles.length) {
    return { success: false, error: "Profile not found." };
  }

  const activeProfileId =
    current.activeProfileId === id ? profiles[0].id : current.activeProfileId;

  const result = writeAiConfig({ profiles, activeProfileId });
  return result.success
    ? { success: true, activeProfileId }
    : { success: false, error: result.error };
}

/** Switches the active profile. Fails if `id` doesn't match a saved profile. */
export function setActiveAiProfile(id: string): {
  success: boolean;
  error?: string;
} {
  const current = readAiConfig();
  if (!current) {
    return { success: false, error: "No AI profiles configured." };
  }
  if (!current.profiles.some((p) => p.id === id)) {
    return { success: false, error: "Profile not found." };
  }

  return writeAiConfig({ profiles: current.profiles, activeProfileId: id });
}

/**
 * Masks an API key for display: keeps the first 5 and last 4 characters,
 * replacing the middle with an ellipsis. Returns a fixed placeholder for
 * keys too short to mask safely.
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 9) {
    return "•••••";
  }
  return apiKey.slice(0, 5) + "…" + apiKey.slice(-4);
}
