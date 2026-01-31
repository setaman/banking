import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");

export const DB_PATHS = {
  real: join(DATA_DIR, "db.json"),
  demo: join(DATA_DIR, "db-demo.json"),
  backup: join(DATA_DIR, "db-backup.json"),
} as const;

export type DbMode = "real" | "demo";
