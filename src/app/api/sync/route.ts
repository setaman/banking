import { NextResponse } from "next/server";
import { loadCredentials } from "@/config/credentials";
import { getAdapter } from "@/lib/banking/adapters";
import { dkbAdapter } from "@/lib/banking/adapters/dkb";
import { registerAdapter } from "@/lib/banking/adapters";
import { syncBank } from "@/lib/banking/sync";
import type { BankCredentials } from "@/lib/banking/types";

// Register adapters on module load
registerAdapter(dkbAdapter);

export async function POST() {
  try {
    // Load credentials from banking.config.json
    const config = loadCredentials();

    if (!config) {
      return NextResponse.json(
        { error: "Banking configuration file not found" },
        { status: 400 },
      );
    }

    // Check for DKB credentials
    if (!config.dkb) {
      return NextResponse.json(
        { error: "DKB credentials not found in configuration" },
        { status: 400 },
      );
    }

    // Get the DKB adapter from registry
    const adapter = getAdapter("dkb");

    if (!adapter) {
      return NextResponse.json(
        { error: "DKB adapter not registered" },
        { status: 500 },
      );
    }

    // Prepare credentials
    const credentials: BankCredentials = {
      cookie: config.dkb.cookie,
      xsrfToken: config.dkb.xsrfToken,
    };

    // Execute sync
    const metadata = await syncBank(adapter, credentials);

    // Return sync metadata
    return NextResponse.json(metadata, { status: 200 });
  } catch (error) {
    console.error("Sync error:", error);

    return NextResponse.json(
      {
        error: "Sync failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
