import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/mysql2/migrator";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { DbHandle } from "./client.js";

/** The SQL migrations shipped with this package (packages/db/drizzle). */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

const MIGRATION_LOCK = "pragya_migrations";
const LOCK_TIMEOUT_S = 120;

/**
 * Runs `work` while holding a MySQL named lock, so concurrent processes (API replicas,
 * parallel test suites) take turns. The lock belongs to one dedicated connection.
 */
export async function withAdvisoryLock<T>(
  pool: Pool,
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?, ?) AS acquired", [
      name,
      LOCK_TIMEOUT_S,
    ]);
    if (rows[0]?.acquired !== 1) throw new Error(`Timed out waiting for lock "${name}"`);
    try {
      return await work();
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [name]);
    }
  } finally {
    connection.release();
  }
}

/** Applies pending migrations; safe to run repeatedly and from several processes at once. */
export async function runMigrations(handle: DbHandle): Promise<void> {
  await withAdvisoryLock(handle.pool, MIGRATION_LOCK, () =>
    migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER }),
  );
}
