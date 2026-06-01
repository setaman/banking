"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  getCredentialStatus,
  saveCredentials,
  type BankingConfig,
} from "@/config/credentials";
import {
  fetchDkbAccounts,
  DkbAuthError,
  DkbNetworkError,
} from "@/lib/banking/adapters/dkb/api";
import type { BankCredentials } from "@/lib/banking/types";
import { getDbMode } from "@/lib/db";

// --- Input schemas ---

const SaveCredentialInputSchema = z.object({
  institution: z.enum(["dkb", "deutscheBank"]),
  cookie: z.string().trim().min(10, "Session cookie looks too short"),
  xsrfToken: z.string().optional(),
});

const TestConnectionInputSchema = z.object({
  cookie: z.string().trim().min(10, "Session cookie looks too short"),
  xsrfToken: z.string().optional(),
});

// --- Action return types ---

export type CredentialStatusResult = ReturnType<typeof getCredentialStatus>;

export type ActionResult = { success: boolean; error?: string };

export type TestConnectionResult =
  | { success: true; accountCount: number }
  | { success: false; error: string };

// --- Actions ---

/**
 * Returns masked credential status for all institutions.
 * Safe to expose to the client — never returns raw cookie values.
 */
export async function getCredentialStatusAction(): Promise<CredentialStatusResult> {
  return getCredentialStatus();
}

/**
 * Validates and persists credentials for the given institution.
 * Revalidates "/" and "/settings" on success.
 */
export async function saveCredentialAction(input: {
  institution: "dkb" | "deutscheBank";
  cookie: string;
  xsrfToken?: string;
}): Promise<ActionResult> {
  const parsed = SaveCredentialInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { institution, cookie, xsrfToken } = parsed.data;

  const result = saveCredentials(institution as keyof BankingConfig, {
    cookie,
    xsrfToken,
  });

  if (result.success) {
    revalidatePath("/");
    revalidatePath("/settings");
  }

  return result;
}

/**
 * Tests a pasted DKB session cookie by making a real accounts API call.
 * Returns the number of accounts found on success.
 * Blocks execution in demo mode.
 */
export async function testConnectionAction(input: {
  cookie: string;
  xsrfToken?: string;
}): Promise<TestConnectionResult> {
  // Block in demo mode — no real network calls allowed
  if (getDbMode() === "demo") {
    return {
      success: false,
      error: "Disable demo mode to test a real connection.",
    };
  }

  const parsed = TestConnectionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const credentials: BankCredentials = {
    cookie: parsed.data.cookie,
    ...(parsed.data.xsrfToken ? { xsrfToken: parsed.data.xsrfToken } : {}),
  };

  try {
    const accounts = await fetchDkbAccounts(credentials);
    return { success: true, accountCount: accounts.length };
  } catch (error) {
    if (error instanceof DkbAuthError) {
      return {
        success: false,
        error: "Session is invalid or expired. Please paste a fresh cookie from DKB.",
      };
    }
    if (error instanceof DkbNetworkError) {
      return {
        success: false,
        error: "Could not reach DKB. Check your internet connection.",
      };
    }
    return {
      success: false,
      error: "Unexpected error while testing the connection.",
    };
  }
}
