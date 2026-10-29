import { index, json, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createdAt, id, primaryId } from "./columns.js";
import { users } from "./identity.js";

/** Append-only record of privileged actions. Rows are never updated or deleted. */
export const auditLog = mysqlTable(
  "audit_log",
  {
    id: primaryId(),
    actorUserId: id("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 60 }).notNull(),
    targetType: varchar("target_type", { length: 40 }).notNull(),
    targetId: varchar("target_id", { length: 26 }).notNull(),
    instituteId: id("institute_id"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_target_idx").on(t.targetType, t.targetId),
    index("audit_log_institute_idx").on(t.instituteId, t.createdAt),
  ],
);
