import { index, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { id, primaryId, timestamps } from "./columns.js";
import { users } from "./identity.js";

/*
 * Tables owned by Better Auth. Property names must match Better Auth's field names
 * (the Drizzle adapter maps by property), so they are camelCase here and snake_case in SQL.
 */

const expiresAt = (name = "expires_at") => timestamp(name, { mode: "date", fsp: 3 });

export const sessions = mysqlTable(
  "sessions",
  {
    id: primaryId(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull(),
    expiresAt: expiresAt().notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 512 }),
    ...timestamps,
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.token), index("sessions_user_idx").on(t.userId)],
);

/** One row per sign-in method: "credential" (password hash) or an OAuth provider. */
export const accounts = mysqlTable(
  "accounts",
  {
    id: primaryId(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 64 }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: expiresAt("access_token_expires_at"),
    refreshTokenExpiresAt: expiresAt("refresh_token_expires_at"),
    scope: varchar("scope", { length: 512 }),
    password: varchar("password", { length: 255 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("accounts_provider_account_uq").on(t.providerId, t.accountId),
    index("accounts_user_idx").on(t.userId),
  ],
);

/** Short-lived tokens: email verification, password reset, phone OTPs. */
export const verifications = mysqlTable(
  "verifications",
  {
    id: primaryId(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: expiresAt().notNull(),
    ...timestamps,
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);
