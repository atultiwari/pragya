export const ROLES = [
  "superadmin",
  "content_reviewer",
  "finance",
  "support",
  "tutor",
  "nodal_officer",
  "teacher",
  "student",
] as const;

export type Role = (typeof ROLES)[number];

export const SCOPE_TYPES = ["platform", "institute", "batch", "course"] as const;

export type ScopeType = (typeof SCOPE_TYPES)[number];

export type Scope =
  | { readonly type: "platform" }
  | { readonly type: "institute"; readonly id: string }
  | { readonly type: "batch"; readonly id: string }
  | { readonly type: "course"; readonly id: string };

export interface RoleAssignment {
  readonly role: Role;
  readonly scope: Scope;
}

/** Which scope types each role may be granted at. Anything else is rejected. */
export const ALLOWED_SCOPES: Readonly<Record<Role, readonly ScopeType[]>> = {
  superadmin: ["platform"],
  content_reviewer: ["platform"],
  finance: ["platform"],
  support: ["platform"],
  tutor: ["platform"],
  nodal_officer: ["institute"],
  teacher: ["institute", "course"],
  student: ["institute", "batch"],
};

export function isValidAssignment(assignment: RoleAssignment): boolean {
  const { scope } = assignment;
  if (scope.type !== "platform" && scope.id.trim() === "") return false;
  return ALLOWED_SCOPES[assignment.role].includes(scope.type);
}
