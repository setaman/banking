import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { Database, DEFAULT_DB } from "./schema";
import { DB_PATHS, DbMode } from "./storage";

/** Instances whose stored file had no `budgets` field (legacy DB). */
const legacyBudgetsDbs = new WeakSet<Low<Database>>();

/**
 * Whether the stored file lacked `budgets` when read (pre-budgets DB).
 * An explicit empty array is not legacy, so deleted budgets stay deleted.
 *
 * @param db - Instance returned by {@link getDb}.
 * @returns True if `budgets` was absent and defaulted in memory.
 */
export function hadMissingBudgets(db: Low<Database>): boolean {
  return legacyBudgetsDbs.has(db);
}

/**
 * Clears the legacy marker once budgets have been persisted.
 *
 * @param db - Instance returned by {@link getDb}.
 */
export function clearMissingBudgets(db: Low<Database>): void {
  legacyBudgetsDbs.delete(db);
}

let dbInstance: Low<Database> | null = null;
let currentMode: DbMode = "real";

export async function getDb(): Promise<Low<Database>> {
  if (dbInstance) return dbInstance;

  const dbPath = DB_PATHS[currentMode];
  const adapter = new JSONFile<Database>(dbPath);
  const db = new Low<Database>(adapter, DEFAULT_DB);

  await db.read();

  if (!db.data) {
    db.data = { ...DEFAULT_DB };
    await db.write();
  }

  // Older db files predate `budgets`; default it without a migration step.
  if (db.data.budgets === undefined) {
    legacyBudgetsDbs.add(db);
    db.data.budgets = [];
  }

  dbInstance = db;
  return db;
}

export function invalidateDbCache(): void {
  dbInstance = null;
}

export function setDbMode(mode: DbMode): void {
  if (mode !== currentMode) {
    currentMode = mode;
    invalidateDbCache();
  }
}

export function getDbMode(): DbMode {
  return currentMode;
}

export async function resetDb(): Promise<void> {
  const db = await getDb();
  db.data = {
    ...DEFAULT_DB,
    meta: {
      ...DEFAULT_DB.meta,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
    },
  };
  await db.write();
  invalidateDbCache();
}
