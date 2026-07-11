import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

// NOTE: This module intentionally defines its own CONFIG_PATH (identical
// value to `@/config/credentials`'s `CONFIG_PATH`) rather than importing it,
// to avoid a circular import: `@/config/credentials` imports `AiConfigSchema`
// from this module to extend its own top-level config schema.
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

export const AiConfigSchema = z.object({
  provider: AiProviderSchema,
  model: z.string().trim().min(1, "Model is required"),
  apiKey: z.string().trim().min(1).optional(),
  baseUrl: z.string().trim().url().optional(),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;

/**
 * Minimal shape of banking.config.json relevant to this module. Kept
 * intentionally loose (all keys optional/unknown-preserving) so that saving
 * the `ai` key never clobbers sibling keys (`dkb`, `deutscheBank`, etc.)
 * managed by `@/config/credentials`.
 */
const RawConfigFileSchema = z
  .object({
    ai: AiConfigSchema.optional(),
  })
  .catchall(z.unknown());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads and validates the `ai` key from banking.config.json. Returns null if
 * the file is missing, unreadable, or the `ai` key fails schema validation.
 * Never exposes the raw config file structure to callers.
 */
export function getAiConfig(): AiConfig | null {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }

  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = RawConfigFileSchema.safeParse(JSON.parse(raw));

    if (!parsed.success || !parsed.data.ai) {
      return null;
    }

    return parsed.data.ai;
  } catch {
    return null;
  }
}

/**
 * Validates and persists the `ai` key in banking.config.json. Merges with
 * (and preserves) all existing sibling keys such as `dkb`/`deutscheBank`.
 * Writes atomically via a temp file rename. Never logs the API key.
 */
export function saveAiConfig(config: AiConfig): {
  success: boolean;
  error?: string;
} {
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
      const parsed = RawConfigFileSchema.safeParse(JSON.parse(raw));
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
