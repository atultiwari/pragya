export { ACTIONS, type Action } from "./actions.js";
export {
  ALLOWED_SCOPES,
  ROLES,
  SCOPE_TYPES,
  isValidAssignment,
  type Role,
  type RoleAssignment,
  type Scope,
  type ScopeType,
} from "./roles.js";
export {
  ForbiddenError,
  assertCan,
  can,
  guest,
  permittedActions,
  user,
  type CourseVisibility,
  type ResourceContext,
  type Subject,
} from "./policy.js";
