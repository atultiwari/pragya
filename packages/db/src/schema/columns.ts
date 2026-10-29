import { sql } from "drizzle-orm";
import { char, timestamp } from "drizzle-orm/mysql-core";
import { ulid } from "ulid";

/** ULID primary/foreign keys, stored as CHAR(26) so they stay readable in SQL and logs. */
export const id = (name = "id") => char(name, { length: 26 });

export const primaryId = () =>
  id()
    .primaryKey()
    .$defaultFn(() => ulid());

/** Millisecond precision; MySQL needs the same precision on DEFAULT and ON UPDATE. */
const NOW_MS = sql`CURRENT_TIMESTAMP(3)`;
const NOW_MS_ON_UPDATE = sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`;

export const createdAt = () =>
  timestamp("created_at", { mode: "date", fsp: 3 }).notNull().default(NOW_MS);

export const timestamps = {
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 }).notNull().default(NOW_MS_ON_UPDATE),
};
