import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

export const CONFIG_PATH = join(process.cwd(), "banking.config.json");

export const BankCredentialSchema = z.object({
  cookie: z.string(),
  xsrfToken: z.string().optional(),
});

export const ConfigSchema = z.object({
  dkb: BankCredentialSchema.optional(),
  deutscheBank: BankCredentialSchema.optional(),
});

export type BankingConfig = z.infer<typeof ConfigSchema>;

export function loadCredentials(): BankingConfig | null {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  const result = ConfigSchema.safeParse(parsed);

  if (!result.success) {
    console.error("Invalid banking.config.json:", result.error.format());
    return null;
  }

  return result.data;
}

export function hasCredentials(institution: keyof BankingConfig): boolean {
  const config = loadCredentials();
  return config !== null && config[institution] !== undefined;
}

/**
 * Returns masked credential status for each supported institution.
 * The preview is a masked representation of the cookie (never the full value).
 */
export function getCredentialStatus(): {
  dkb: { configured: boolean; preview: string | null };
  deutscheBank: { configured: boolean; preview: string | null };
} {
  const config = loadCredentials();

  const maskCookie = (cookie: string | undefined): string | null => {
    if (!cookie) return null;
    return cookie.slice(0, 5) + "…" + cookie.slice(-4);
  };

  return {
    dkb: {
      configured: !!config?.dkb?.cookie,
      preview: maskCookie(config?.dkb?.cookie),
    },
    deutscheBank: {
      configured: !!config?.deutscheBank?.cookie,
      preview: maskCookie(config?.deutscheBank?.cookie),
    },
  };
}

/**
 * Saves or updates credentials for a single institution in banking.config.json.
 * Writes atomically via a temp file rename. Sibling institutions are preserved.
 * Never logs secret values.
 */
export function saveCredentials(
  institution: keyof BankingConfig,
  credential: { cookie: string; xsrfToken?: string }
): { success: boolean; error?: string } {
  const validation = BankCredentialSchema.safeParse({
    cookie: credential.cookie?.trim(),
    xsrfToken: credential.xsrfToken?.trim() || undefined,
  });

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues.map((i) => i.message).join(", "),
    };
  }

  const trimmed = {
    cookie: validation.data.cookie.trim(),
    ...(validation.data.xsrfToken
      ? { xsrfToken: validation.data.xsrfToken.trim() }
      : {}),
  };

  try {
    // Read existing config or start with empty object
    let existing: BankingConfig = {};
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const parsed = ConfigSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        existing = parsed.data;
      }
    }

    // Merge: overwrite only the given institution, preserve siblings
    const updated: BankingConfig = {
      ...existing,
      [institution]: trimmed,
    };

    const tmpPath = CONFIG_PATH + ".tmp";
    writeFileSync(tmpPath, JSON.stringify(updated, null, 2), "utf-8");
    renameSync(tmpPath, CONFIG_PATH);

    return { success: true };
  } catch {
    // Do not leak filesystem paths or secret values in the error message
    return {
      success: false,
      error: "Failed to save credentials. Check file system permissions.",
    };
  }
}
