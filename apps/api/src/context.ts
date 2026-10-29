import { guest, type Subject } from "@pragya/authz";
import type { FastifyRequest } from "fastify";

export interface RequestContext {
  readonly subject: Subject;
}

/**
 * Resolves who is calling. Until Better Auth sessions land (next Phase 0 step),
 * every caller is a guest, which is the safe default.
 */
export function resolveSubject(_request: FastifyRequest): Subject {
  return guest();
}

export function createRequestContext(request: FastifyRequest): RequestContext {
  return { subject: resolveSubject(request) };
}
