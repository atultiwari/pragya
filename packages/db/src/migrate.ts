import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/mysql2/migrator";
import type { Database } from "./client.js";

/** The SQL migrations shipped with this package (packages/db/drizzle). */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

/** Applies pending migrations; safe to run repeatedly. */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
