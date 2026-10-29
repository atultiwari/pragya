import {
  boolean,
  index,
  mysqlTable,
  uniqueIndex,
  varchar,
  mysqlEnum,
} from "drizzle-orm/mysql-core";
import { ROLES, SCOPE_TYPES } from "@pragya/authz";
import { id, primaryId, timestamps } from "./columns.js";

/** Core user record; column set matches what Better Auth expects for its `user` model. */
export const users = mysqlTable(
  "users",
  {
    id: primaryId(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    /** E.164 number; set and verified by Better Auth's phone-number (OTP) plugin. */
    phoneNumber: varchar("phone_number", { length: 20 }),
    phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),
    image: varchar("image", { length: 2048 }),
    /** Public leaderboard handle; real names are opt-in. */
    handle: varchar("handle", { length: 40 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_phone_uq").on(t.phoneNumber),
    uniqueIndex("users_handle_uq").on(t.handle),
  ],
);

/**
 * Scoped role grants. Platform-wide grants store an empty `scope_id` so the unique index
 * also prevents duplicate platform roles (MySQL treats NULLs as distinct).
 */
export const roleAssignments = mysqlTable(
  "role_assignments",
  {
    id: primaryId(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ROLES).notNull(),
    scopeType: mysqlEnum("scope_type", SCOPE_TYPES).notNull(),
    scopeId: varchar("scope_id", { length: 26 }).notNull().default(""),
    grantedBy: id("granted_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("role_assignments_uq").on(t.userId, t.role, t.scopeType, t.scopeId),
    index("role_assignments_scope_idx").on(t.scopeType, t.scopeId),
  ],
);
