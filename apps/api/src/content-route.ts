import { can, type Subject } from "@pragya/authz";
import { packPathSchema, slugSchema } from "@pragya/content";
import type { FastifyInstance } from "fastify";
import { readFile, realpath } from "node:fs/promises";
import { extname, join, sep } from "node:path";
import { toWebHeaders, type SubjectResolver } from "./context.js";
import { courseFacts } from "./routers/facts.js";
import type { Services } from "./services.js";

/** Figure types a pack may contain; anything else is never served. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** An SVG opened directly in a tab must not run script or load anything. */
const FIGURE_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox";

async function mayView(
  subject: Subject,
  services: Services,
  courseSlug: string,
  src: string,
): Promise<boolean> {
  const use = await services.catalogue.getFigureUse(courseSlug, src);
  if (!use || use.lessons.length === 0) return false;
  const facts = await courseFacts(subject, services, use.course);
  if (!can(subject, "course.read", facts)) return false;
  // A figure is as visible as the most open lesson that uses it.
  return use.lessons.some((lesson) =>
    can(subject, "lesson.read", { ...facts, isPreview: lesson.isPreview }),
  );
}

async function readConfined(root: string, relative: string): Promise<Buffer | null> {
  try {
    const resolved = await realpath(join(root, relative));
    if (!resolved.startsWith(root + sep)) return null;
    return await readFile(resolved);
  } catch (error: unknown) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR") return null;
    throw error;
  }
}

export interface ContentRouteOptions {
  readonly assetsDir: string;
  readonly services: Services;
  readonly resolveSubject: SubjectResolver;
}

/**
 * Serves pack figures with the same access rule as the lessons that use them (D-023).
 * Missing, hidden and forbidden all answer 404 so nothing about paid content leaks.
 */
export async function registerContentRoutes(
  app: FastifyInstance,
  options: ContentRouteOptions,
): Promise<void> {
  const root = await realpath(options.assetsDir);
  app.get<{ Params: { course: string; "*": string } }>(
    "/content/:course/*",
    async (request, reply) => {
      const course = slugSchema.safeParse(request.params.course);
      const src = packPathSchema.safeParse(request.params["*"]);
      const contentType = src.success ? CONTENT_TYPES[extname(src.data).toLowerCase()] : undefined;
      const notFound = () => reply.callNotFound();
      if (!course.success || !src.success || !contentType) return notFound();

      const subject = await options.resolveSubject(toWebHeaders(request.headers));
      if (!(await mayView(subject, options.services, course.data, src.data))) return notFound();
      const body = await readConfined(root, join(course.data, src.data));
      if (!body) return notFound();

      return reply
        .header("content-type", contentType)
        .header("content-security-policy", FIGURE_CSP)
        .header("cross-origin-resource-policy", "same-site")
        .header("cache-control", "private, max-age=300")
        .send(body);
    },
  );
}
