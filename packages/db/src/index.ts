export { createDb, type Database, type DbHandle } from "./client.js";
export { MIGRATIONS_FOLDER, runMigrations, withAdvisoryLock } from "./migrate.js";
export * as schema from "./schema/index.js";
export {
  createRoleAssignmentRepository,
  fromRoleAssignmentRow,
  toRoleAssignmentValues,
  type GrantRoleInput,
  type RoleAssignmentRepository,
} from "./repositories/role-assignments.js";
export {
  createBatchRepository,
  parseCreateBatchInput,
  type Batch,
  type BatchRepository,
  type CreateBatchInput,
} from "./repositories/batches.js";
export { upsertStreams, type StreamSeed } from "./repositories/streams.js";
export { findUserByEmail, type UserIdentity } from "./repositories/users.js";
export {
  CourseImportError,
  importCourse,
  type CourseImport,
  type ImportSummary,
  type LessonImport,
  type ModuleImport,
  type QuestionImport,
} from "./repositories/course-import.js";
export {
  createCatalogueRepository,
  type CatalogueRepository,
  type CourseOutline,
  type CoursePage,
  type CourseSummary,
  type FigureUse,
  type LessonView,
  type ListCoursesQuery,
  type OutlineLesson,
} from "./repositories/catalogue.js";
export {
  createEnrollmentRepository,
  type EnrolInput,
  type EnrolOutcome,
  type EnrollmentRepository,
} from "./repositories/enrollments.js";
export {
  createQuestionRepository,
  type AttemptInput,
  type QuestionRepository,
  type QuestionRepositoryOptions,
  type StoredQuestion,
} from "./repositories/questions.js";
