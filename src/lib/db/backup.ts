import { copyFile, access } from "fs/promises";

import { DB_PATHS } from "./storage";
import { getDbMode } from "./index";

/**
 * Creates a backup copy of the current database file before sync.
 * Uses fs.copyFile for atomic OS-level copy.
 * Non-throwing — backup failure should not block sync.
 */
export async function createBackup(): Promise<{
  success: boolean;
  error?: string;
}> {
  const mode = getDbMode();
  const sourcePath = DB_PATHS[mode];
  const backupPath = DB_PATHS.backup;

  try {
    await access(sourcePath);
    await copyFile(sourcePath, backupPath);
    return { success: true };
  } catch (error) {
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
