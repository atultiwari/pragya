import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import * as schema from "./schema/index.js";

export type Database = MySql2Database<typeof schema>;

export interface DbHandle {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

export function createDb(databaseUrl: string): DbHandle {
  const pool: Pool = createPool({ uri: databaseUrl, connectionLimit: 10, timezone: "Z" });
  const db = drizzle(pool, { schema, mode: "default" });
  return { db, close: () => pool.end() };
}
