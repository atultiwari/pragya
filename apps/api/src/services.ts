import type { CatalogueRepository, EnrollmentRepository, QuestionRepository } from "@pragya/db";

/** Data access the procedures need; real repositories in the app, in-memory fakes in tests. */
export interface Services {
  readonly catalogue: CatalogueRepository;
  readonly enrollments: EnrollmentRepository;
  readonly questions: QuestionRepository;
}

const unavailable = (): never => {
  throw new Error("Data services are not configured for this server");
};

/** Used when the server runs without a database (unit tests of unrelated routes). */
export const NO_SERVICES: Services = {
  catalogue: {
    listCourses: unavailable,
    getCourse: unavailable,
    getLesson: unavailable,
    getLessonBlocks: unavailable,
    getFigureUse: unavailable,
  },
  enrollments: { isEnrolled: unavailable, enrol: unavailable, isInstituteMember: unavailable },
  questions: { listPools: unavailable, findInPools: unavailable, recordAttempt: unavailable },
};
