import {
  isValidAssignment,
  type Role,
  type RoleAssignment,
  type Scope,
  type ScopeType,
} from "@pragya/authz";
import { eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { roleAssignments } from "../schema/index.js";

export interface RoleAssignmentRow {
  readonly role: Role;
  readonly scopeType: ScopeType;
  readonly scopeId: string;
}

export interface GrantRoleInput {
  readonly userId: string;
  readonly assignment: RoleAssignment;
  readonly grantedBy?: string;
}

export interface RoleAssignmentValues extends RoleAssignmentRow {
  readonly userId: string;
  readonly grantedBy: string | null;
}

function toScope(scopeType: ScopeType, scopeId: string): Scope | null {
  if (scopeType === "platform") return { type: "platform" };
  return scopeId === "" ? null : { type: scopeType, id: scopeId };
}

/** Maps a stored row to an authz assignment, dropping rows that would be invalid grants. */
export function fromRoleAssignmentRow(row: RoleAssignmentRow): RoleAssignment | null {
  const scope = toScope(row.scopeType, row.scopeId);
  if (scope === null) return null;
  const assignment: RoleAssignment = { role: row.role, scope };
  return isValidAssignment(assignment) ? assignment : null;
}

export function toRoleAssignmentValues(input: GrantRoleInput): RoleAssignmentValues {
  const { assignment } = input;
  if (!isValidAssignment(assignment)) {
    throw new Error(
      `Role "${assignment.role}" cannot be granted at "${assignment.scope.type}" scope`,
    );
  }
  return {
    userId: input.userId,
    role: assignment.role,
    scopeType: assignment.scope.type,
    scopeId: assignment.scope.type === "platform" ? "" : assignment.scope.id,
    grantedBy: input.grantedBy ?? null,
  };
}

export interface RoleAssignmentRepository {
  listForUser(userId: string): Promise<readonly RoleAssignment[]>;
  grant(input: GrantRoleInput): Promise<void>;
}

export function createRoleAssignmentRepository(db: Database): RoleAssignmentRepository {
  return {
    async listForUser(userId) {
      const rows = await db
        .select({
          role: roleAssignments.role,
          scopeType: roleAssignments.scopeType,
          scopeId: roleAssignments.scopeId,
        })
        .from(roleAssignments)
        .where(eq(roleAssignments.userId, userId));
      return rows.map(fromRoleAssignmentRow).filter((a): a is RoleAssignment => a !== null);
    },

    async grant(input) {
      const values = toRoleAssignmentValues(input);
      // Re-granting an existing role is a no-op rather than an error.
      await db
        .insert(roleAssignments)
        .values(values)
        .onDuplicateKeyUpdate({ set: { scopeId: values.scopeId } });
    },
  };
}
