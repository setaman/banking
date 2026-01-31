import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { Database, DEFAULT_DB } from "./schema";
import { DB_PATHS, DbMode } from "./storage";

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
