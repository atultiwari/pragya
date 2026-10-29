import { can } from "@pragya/authz";
import { slugSchema } from "@pragya/content";
import { z } from "zod";
import { publicProcedure, router } from "../trpc.js";
import { courseFacts } from "./facts.js";
import { courseNotFound, loadReadableLesson } from "./lesson-access.js";

const MAX_PAGE_SIZE = 50;

const notFound = courseNotFound;

export const catalogueRouter = router({
  listCourses: publicProcedure
    .input(
      z.object({
        stream: slugSchema.optional(),
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.services.catalogue.listCourses({
        streamSlug: input.stream,
        page: input.page,
        pageSize: input.pageSize,
      }),
    ),

  course: publicProcedure.input(z.object({ slug: slugSchema })).query(async ({ ctx, input }) => {
    const course = await ctx.services.catalogue.getCourse(input.slug);
    if (!course) throw notFound();
    const facts = await courseFacts(ctx.subject, ctx.services, course);
    if (!can(ctx.subject, "course.read", facts)) throw notFound();
    const { id: _id, instituteId: _instituteId, status: _status, modules, ...visible } = course;
    return {
      ...visible,
      // Internal row ids stay server-side; clients address lessons by slug.
      modules: modules.map((module) => ({
        ...module,
        lessons: module.lessons.map(({ id: _lessonId, ...lesson }) => lesson),
      })),
      access: {
        enrolled: facts.isEnrolled === true,
        canEnrolFree:
          course.pricePaise === 0 &&
          facts.isEnrolled !== true &&
          can(ctx.subject, "enrollment.create", facts),
      },
    };
  }),

  lesson: publicProcedure
    .input(z.object({ courseSlug: slugSchema, lessonSlug: slugSchema }))
    .query(async ({ ctx, input }) => {
      const { lesson, blocks } = await loadReadableLesson(ctx, input.courseSlug, input.lessonSlug);
      const { id: _id, course, ...visible } = lesson;
      return { ...visible, blocks, course: { slug: course.slug, title: course.title } };
    }),
});
