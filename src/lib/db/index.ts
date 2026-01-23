import { join } from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { Database, DEFAULT_DB } from "./schema";

let dbInstance: Low<Database> | null = null;

const DB_PATH = join(process.cwd(), "data", "db.json");

export async function getDb(): Promise<Low<Database>> {
  if (dbInstance) return dbInstance;

  const adapter = new JSONFile<Database>(DB_PATH);
  const db = new Low<Database>(adapter, DEFAULT_DB);

  await db.read();

  if (!db.data) {
    db.data = { ...DEFAULT_DB };
    await db.write();
  }

  dbInstance = db;
  return db;
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
}
