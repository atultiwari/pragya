import { guest, user, type RoleAssignment, type Subject } from "@pragya/authz";
import type { IncomingHttpHeaders } from "node:http";
import type { Services } from "./services.js";

export interface RequestContext {
  readonly subject: Subject;
  readonly services: Services;
}

export type SubjectResolver = (headers: Headers) => Promise<Subject>;

export interface SubjectSources {
  /** The session's user id, or null when there is no valid session. */
  readonly getUserId: (headers: Headers) => Promise<string | null>;
  readonly listAssignments: (userId: string) => Promise<readonly RoleAssignment[]>;
}

/**
 * Builds the caller's authz subject from their session and stored role grants.
 * Lookup failures propagate (→ 500) rather than quietly treating the caller as a guest.
 */
export function createSubjectResolver(sources: SubjectSources): SubjectResolver {
  return async (headers) => {
    const userId = await sources.getUserId(headers);
    if (userId === null) return guest();
    return user(userId, await sources.listAssignments(userId));
  };
}

/** Resolver used when no auth is configured: everyone is a guest. */
export const guestResolver: SubjectResolver = async () => guest();

export function toWebHeaders(nodeHeaders: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  return headers;
}
