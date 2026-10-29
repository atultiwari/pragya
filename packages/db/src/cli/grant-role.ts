import { createDb } from "../client.js";
import { createRoleAssignmentRepository } from "../repositories/role-assignments.js";
import { findUserByEmail } from "../repositories/users.js";
import { parseGrantRoleArgs } from "./args.js";

/**
 * `pnpm --filter @pragya/db grant-role --email a@b.c --role superadmin [--scope institute:<id>] [--allow-unverified]`
 * Bootstraps the first superadmin and other operator grants. The user must have signed up first.
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

let args;
try {
  args = parseGrantRoleArgs(process.argv.slice(2));
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}

const handle = createDb(databaseUrl);
try {
  const found = await findUserByEmail(handle.db, args.email);
  if (found === null) throw new Error(`No user with email ${args.email}; sign up first`);
  // Without verification anyone could pre-register an operator's address and receive the grant.
  if (!found.emailVerified && !args.allowUnverified) {
    throw new Error(
      `${args.email} is not verified; verify it first (or pass --allow-unverified locally)`,
    );
  }
  await createRoleAssignmentRepository(handle.db).grant({
    userId: found.id,
    assignment: args.assignment,
  });
  const scope =
    args.assignment.scope.type === "platform"
      ? "platform"
      : `${args.assignment.scope.type}:${args.assignment.scope.id}`;
  console.warn(`Granted ${args.assignment.role} (${scope}) to ${args.email} [user ${found.id}]`);
} catch (error: unknown) {
  console.error("Grant failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await handle.close();
}
