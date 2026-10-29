import { eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { users } from "../schema/index.js";

export interface UserIdentity {
  readonly id: string;
  readonly emailVerified: boolean;
}

/** Emails are compared case-insensitively (utf8mb4_0900_ai_ci) and normalised to lower case. */
export async function findUserByEmail(db: Database, email: string): Promise<UserIdentity | null> {
  const [row] = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}
