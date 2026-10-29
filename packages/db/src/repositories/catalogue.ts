import { and, asc, count, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { Database } from "../client.js";
import { courses, lessons, modules, streams } from "../schema/index.js";

type Visibility = (typeof courses.$inferSelect)["visibility"];
type Status = (typeof courses.$inferSelect)["status"];

export interface CourseSummary {
  readonly slug: string;
  readonly title: string;
  readonly summary: string | null;
  readonly pricePaise: number;
  readonly language: string;
  readonly lessonCount: number;
  readonly stream: { readonly slug: string; readonly name: string };
}

export interface CoursePage {
  readonly items: readonly CourseSummary[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface OutlineLesson {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly isPreview: boolean;
}

/** Access facts plus the outline; callers decide visibility with @pragya/authz. */
export interface CourseOutline extends Omit<CourseSummary, "lessonCount"> {
  readonly id: string;
  readonly status: Status;
  readonly visibility: Visibility;
  readonly instituteId: string | null;
  readonly modules: readonly {
    readonly slug: string;
    readonly title: string;
    readonly lessons: readonly OutlineLesson[];
  }[];
}

/** Lesson metadata; the body is fetched with getLessonBlocks once access is granted. */
export interface LessonView {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly isPreview: boolean;
  readonly previous: { readonly slug: string; readonly title: string } | null;
  readonly next: { readonly slug: string; readonly title: string } | null;
  readonly course: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly status: Status;
    readonly visibility: Visibility;
    readonly instituteId: string | null;
    readonly pricePaise: number;
  };
}

export interface ListCoursesQuery {
  readonly streamSlug?: string | undefined;
  readonly page: number;
  readonly pageSize: number;
}

export interface FigureUse {
  readonly course: LessonView["course"];
  /** Every lesson of the course whose blocks reference the figure. */
  readonly lessons: readonly { readonly isPreview: boolean }[];
}

export interface CatalogueRepository {
  listCourses(query: ListCoursesQuery): Promise<CoursePage>;
  getCourse(slug: string): Promise<CourseOutline | null>;
  getLesson(courseSlug: string, lessonSlug: string): Promise<LessonView | null>;
  getLessonBlocks(lessonId: string): Promise<readonly unknown[]>;
  getFigureUse(courseSlug: string, src: string): Promise<FigureUse | null>;
}

/** JSON_SEARCH treats % and _ as wildcards; escape them (and the escape char) to match literally. */
const likeLiteral = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** The public marketplace shows published courses that are listed publicly. */
const LISTED: SQL | undefined = and(
  eq(courses.status, "published"),
  inArray(courses.visibility, ["public", "public_and_institute"]),
);

const courseColumns = {
  id: courses.id,
  slug: courses.slug,
  title: courses.title,
  summary: courses.summary,
  pricePaise: courses.pricePaise,
  language: courses.language,
  status: courses.status,
  visibility: courses.visibility,
  instituteId: courses.instituteId,
  streamSlug: streams.slug,
  streamName: streams.name,
};

async function orderedLessons(db: Database, courseId: string) {
  return db
    .select({
      id: lessons.id,
      slug: lessons.slug,
      title: lessons.title,
      isPreview: lessons.isPreview,
      moduleSlug: modules.slug,
      moduleTitle: modules.title,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(modules.position), asc(lessons.position));
}

type OrderedLesson = Awaited<ReturnType<typeof orderedLessons>>[number];

function groupByModule(rows: readonly OrderedLesson[]): CourseOutline["modules"] {
  const groups: { slug: string; title: string; lessons: OutlineLesson[] }[] = [];
  for (const { moduleSlug, moduleTitle, ...lesson } of rows) {
    const last = groups.at(-1);
    if (last?.slug === moduleSlug) last.lessons.push(lesson);
    else groups.push({ slug: moduleSlug, title: moduleTitle, lessons: [lesson] });
  }
  return groups;
}

async function findCourse(db: Database, slug: string) {
  const [row] = await db
    .select(courseColumns)
    .from(courses)
    .innerJoin(streams, eq(courses.streamId, streams.id))
    .where(eq(courses.slug, slug))
    .limit(1);
  return row ?? null;
}

const courseAccess = (
  course: NonNullable<Awaited<ReturnType<typeof findCourse>>>,
): LessonView["course"] => ({
  id: course.id,
  slug: course.slug,
  title: course.title,
  status: course.status,
  visibility: course.visibility,
  instituteId: course.instituteId,
  pricePaise: course.pricePaise,
});

export function createCatalogueRepository(db: Database): CatalogueRepository {
  return {
    async listCourses({ streamSlug, page, pageSize }) {
      const where = and(LISTED, streamSlug ? eq(streams.slug, streamSlug) : undefined);
      const [rows, [totals]] = await Promise.all([
        db
          .select({ ...courseColumns, lessonCount: count(lessons.id) })
          .from(courses)
          .innerJoin(streams, eq(courses.streamId, streams.id))
          .leftJoin(lessons, eq(lessons.courseId, courses.id))
          .where(where)
          .groupBy(courses.id, streams.id)
          .orderBy(asc(streams.sortOrder), asc(courses.title))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ total: count() })
          .from(courses)
          .innerJoin(streams, eq(courses.streamId, streams.id))
          .where(where),
      ]);
      return {
        items: rows.map((row) => ({
          slug: row.slug,
          title: row.title,
          summary: row.summary,
          pricePaise: row.pricePaise,
          language: row.language,
          lessonCount: row.lessonCount,
          stream: { slug: row.streamSlug, name: row.streamName },
        })),
        total: totals?.total ?? 0,
        page,
        pageSize,
      };
    },

    async getCourse(slug) {
      const course = await findCourse(db, slug);
      if (!course) return null;
      const { streamSlug, streamName, ...rest } = course;
      return {
        ...rest,
        stream: { slug: streamSlug, name: streamName },
        modules: groupByModule(await orderedLessons(db, course.id)),
      };
    },

    async getLesson(courseSlug, lessonSlug) {
      const course = await findCourse(db, courseSlug);
      if (!course) return null;
      const ordered = await orderedLessons(db, course.id);
      const index = ordered.findIndex((l) => l.slug === lessonSlug);
      const current = ordered[index];
      if (!current) return null;
      const neighbour = (l: OrderedLesson | undefined) =>
        l ? { slug: l.slug, title: l.title } : null;
      return {
        id: current.id,
        slug: current.slug,
        title: current.title,
        isPreview: current.isPreview,
        previous: neighbour(ordered[index - 1]),
        next: neighbour(ordered[index + 1]),
        course: courseAccess(course),
      };
    },

    async getLessonBlocks(lessonId) {
      const [row] = await db
        .select({ blocks: lessons.blocks })
        .from(lessons)
        .where(eq(lessons.id, lessonId))
        .limit(1);
      return row?.blocks ?? [];
    },

    async getFigureUse(courseSlug, src) {
      const course = await findCourse(db, courseSlug);
      if (!course) return null;
      const referencing = await db
        .select({ isPreview: lessons.isPreview })
        .from(lessons)
        .where(
          and(
            eq(lessons.courseId, course.id),
            sql`JSON_SEARCH(${lessons.blocks}, 'one', ${likeLiteral(src)}, ${"\\"}, '$[*].src') IS NOT NULL`,
          ),
        );
      return { course: courseAccess(course), lessons: referencing };
    },
  };
}
