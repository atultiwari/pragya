import {
  ROLES,
  SCOPE_TYPES,
  isValidAssignment,
  type RoleAssignment,
  type Scope,
} from "@pragya/authz";
import { parseArgs } from "node:util";
import { z } from "zod";

export interface GrantRoleArgs {
  readonly email: string;
  readonly assignment: RoleAssignment;
  /** Local development only: grant even though the email was never verified. */
  readonly allowUnverified: boolean;
}

const argsSchema = z.object({
  email: z
    .string({ error: "--email is required" })
    .trim()
    .toLowerCase()
    .pipe(z.email("--email must be an email")),
  role: z.enum(ROLES, { error: `--role must be one of: ${ROLES.join(", ")}` }),
  scope: z.string().optional(),
  "allow-unverified": z.boolean().optional(),
});

function parseScope(raw: string | undefined): Scope {
  if (raw === undefined) return { type: "platform" };
  const [type, id, ...rest] = raw.split(":");
  if (!type || !id || rest.length > 0)
    throw new Error("--scope must look like type:id, e.g. institute:01H…");
  if (type === "platform" || !(SCOPE_TYPES as readonly string[]).includes(type)) {
    throw new Error(
      `--scope type must be one of: ${SCOPE_TYPES.filter((t) => t !== "platform").join(", ")}`,
    );
  }
  return { type: type as Exclude<Scope["type"], "platform">, id };
}

/** Parses `grant-role --email … --role … [--scope type:id]`; omitting --scope means platform-wide. */
export function parseGrantRoleArgs(argv: readonly string[]): GrantRoleArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      email: { type: "string" },
      role: { type: "string" },
      scope: { type: "string" },
      "allow-unverified": { type: "boolean" },
    },
    strict: true,
  });
  const result = argsSchema.safeParse(values);
  if (!result.success)
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));

  const assignment: RoleAssignment = {
    role: result.data.role,
    scope: parseScope(result.data.scope),
  };
  if (!isValidAssignment(assignment)) {
    throw new Error(
      `Role "${assignment.role}" cannot be granted at "${assignment.scope.type}" scope`,
    );
  }
  return {
    email: result.data.email,
    assignment,
    allowUnverified: result.data["allow-unverified"] ?? false,
  };
}
