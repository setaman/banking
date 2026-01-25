import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { z } from "zod";

const CONFIG_PATH = join(process.cwd(), "banking.config.json");

const BankCredentialSchema = z.object({
  cookie: z.string(),
  xsrfToken: z.string().optional(),
});

const ConfigSchema = z.object({
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
