import { and, asc, count, eq, gt, inArray, or, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "../client.js";
import { lessons, questionAttempts, questions } from "../schema/index.js";

export interface StoredQuestion {
  readonly id: string;
  readonly slug: string;
  /** Whether the question's own lesson is a free preview; callers check access per question. */
  readonly lessonIsPreview: boolean;
  readonly body: Record<string, unknown>;
}

export interface AttemptInput {
  readonly userId: string;
  readonly questionId: string;
  readonly courseId: string;
  readonly isCorrect: boolean | null;
  readonly response: Record<string, unknown>;
}

export interface QuestionRepository {
  /** Questions of a course whose lesson slug or tags match any pool, in lesson order. */
  listPools(courseId: string, pools: readonly string[]): Promise<readonly StoredQuestion[]>;
  findInPools(
    courseId: string,
    slug: string,
    pools: readonly string[],
  ): Promise<StoredQuestion | null>;
  /** Records an attempt; false (nothing stored) once the user exceeds the per-minute limit. */
  recordAttempt(input: AttemptInput): Promise<boolean>;
}

export interface QuestionRepositoryOptions {
  readonly maxAttemptsPerMinute?: number;
}

const DEFAULT_MAX_ATTEMPTS_PER_MINUTE = 30;
const MINUTE_MS = 60_000;

const MAX_POOL_QUESTIONS = 100;

/** A quiz pool is a lesson slug or a question tag (see CONTENT_AUTHORING.md). */
const inPools = (pools: readonly string[]) =>
  or(
    inArray(lessons.slug, [...pools]),
    sql`JSON_OVERLAPS(${questions.tags}, CAST(${JSON.stringify(pools)} AS JSON))`,
  );

export function createQuestionRepository(
  db: Database,
  { maxAttemptsPerMinute = DEFAULT_MAX_ATTEMPTS_PER_MINUTE }: QuestionRepositoryOptions = {},
): QuestionRepository {
  const select = () =>
    db
      .select({
        id: questions.id,
        slug: questions.slug,
        lessonIsPreview: lessons.isPreview,
        body: questions.body,
      })
      .from(questions)
      .innerJoin(lessons, eq(questions.lessonId, lessons.id));

  return {
    async listPools(courseId, pools) {
      if (pools.length === 0) return [];
      return select()
        .where(and(eq(questions.courseId, courseId), inPools(pools)))
        .orderBy(asc(lessons.position), asc(questions.slug))
        .limit(MAX_POOL_QUESTIONS);
    },

    async findInPools(courseId, slug, pools) {
      if (pools.length === 0) return null;
      const [row] = await select()
        .where(and(eq(questions.courseId, courseId), eq(questions.slug, slug), inPools(pools)))
        .limit(1);
      return row ?? null;
    },

    async recordAttempt(input) {
      const [recent] = await db
        .select({ attempts: count() })
        .from(questionAttempts)
        .where(
          and(
            eq(questionAttempts.userId, input.userId),
            gt(questionAttempts.createdAt, new Date(Date.now() - MINUTE_MS)),
          ),
        );
      if ((recent?.attempts ?? 0) >= maxAttemptsPerMinute) return false;
      await db.insert(questionAttempts).values({ id: ulid(), ...input });
      return true;
    },
  };
}
