import {
  foreignKey,
  index,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { id, primaryId, timestamps } from "./columns.js";
import { users } from "./identity.js";

export const institutes = mysqlTable(
  "institutes",
  {
    id: primaryId(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    status: mysqlEnum("status", ["active", "suspended"]).notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("institutes_slug_uq").on(t.slug)],
);

export const batches = mysqlTable(
  "batches",
  {
    id: primaryId(),
    instituteId: id("institute_id")
      .notNull()
      .references(() => institutes.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    /** e.g. "MBBS 2024", "Phase II". */
    cohort: varchar("cohort", { length: 60 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("batches_institute_name_uq").on(t.instituteId, t.name),
    // Target of batch_members' composite FK, which pins a member row to its batch's institute.
    uniqueIndex("batches_id_institute_uq").on(t.id, t.instituteId),
  ],
);

export const batchMembers = mysqlTable(
  "batch_members",
  {
    batchId: id("batch_id").notNull(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Denormalised for tenant-scoped queries; the composite FK keeps it equal to the batch's. */
    instituteId: id("institute_id").notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.batchId, t.userId] }),
    index("batch_members_institute_idx").on(t.instituteId),
    foreignKey({
      name: "batch_members_batch_fk",
      columns: [t.batchId, t.instituteId],
      foreignColumns: [batches.id, batches.instituteId],
    }).onDelete("cascade"),
  ],
);
