import { copyFile, mkdir } from "fs/promises";
import { dirname } from "path";

import { DB_PATHS } from "./storage";
import { getDb, getDbMode } from "./index";

/** Structured result for backup/restore operations. */
export interface OperationResult {
  success: boolean;
  error?: string;
}

/**
 * Creates a backup copy of the current database file before sync.
 * Flushes in-memory DB state to disk first, then copies the file.
 * Non-throwing — backup failure should not block sync.
 */
export async function createBackup(): Promise<OperationResult> {
  const mode = getDbMode();
  const sourcePath = DB_PATHS[mode];
  const backupPath = DB_PATHS.backup;

  try {
    // Flush any in-memory mutations to disk before copying
    const db = await getDb();
    await db.write();

    // Ensure backup directory exists
    await mkdir(dirname(backupPath), { recursive: true });

    await copyFile(sourcePath, backupPath);
    return { success: true };
  } catch (error) {
    // Source file doesn't exist (first run) — nothing to back up
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { success: true };
    }
    console.error("[Backup] Failed to create backup:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
