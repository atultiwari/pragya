import Link from "next/link";
import {
  completionPercent,
  courseHref,
  formatAccuracy,
  formatLastActive,
  lessonHref,
  type DashboardCourse,
  type Overview,
} from "@/lib/dashboard";

interface DashboardViewProps {
  readonly overview: Overview;
  /** Fixed in tests so relative dates are stable. */
  readonly now?: Date;
}

function ResumeCard({ resume }: { readonly resume: NonNullable<Overview["resume"]> }) {
  return (
    <section className="resume" aria-labelledby="resume-heading">
      <p className="eyebrow" id="resume-heading">
        Continue where you left off
      </p>
      <h2 className="resume-title">{resume.lessonTitle}</h2>
      <p className="muted">{resume.courseTitle}</p>
      <Link className="button-link" href={lessonHref(resume.courseSlug, resume.lessonSlug)}>
        Resume lesson
      </Link>
    </section>
  );
}

function PracticeSummary({ practice }: { readonly practice: DashboardCourse["practice"] }) {
  if (!practice) return <p className="muted">No practice answers yet.</p>;
  return (
    <details className="practice-detail">
      <summary>
        Practice accuracy <strong>{formatAccuracy(practice.accuracy)}</strong>{" "}
        <span className="muted">
          ({practice.correct} of {practice.graded} graded, {practice.attempted} answered)
        </span>
      </summary>
      <table>
        <thead>
          <tr>
            <th scope="col">Lesson</th>
            <th scope="col">Answered</th>
            <th scope="col">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {practice.lessons.map((lesson) => (
            <tr key={lesson.slug}>
              <th scope="row">{lesson.title}</th>
              <td>{lesson.attempted}</td>
              <td>{formatAccuracy(lesson.accuracy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function CourseProgress({ course, now }: { readonly course: DashboardCourse; readonly now: Date }) {
  const percent = completionPercent(course.lessonsCompleted, course.lessonsTotal);
  const label = `${course.lessonsCompleted} of ${course.lessonsTotal} lessons complete`;
  return (
    <li className="card progress-card">
      <h3 className="card-title">
        <Link href={courseHref(course.slug)}>{course.title}</Link>
      </h3>
      <p className="muted">
        {label} · active {formatLastActive(course.lastActivityAt, now)}
      </p>
      <div
        className="meter"
        role="progressbar"
        aria-label={`${course.title} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={label}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      {course.nextLesson ? (
        <p>
          Next:{" "}
          <Link href={lessonHref(course.slug, course.nextLesson.slug)}>
            {course.nextLesson.title}
          </Link>
        </p>
      ) : (
        <p className="status status-online">Course complete</p>
      )}
      <PracticeSummary practice={course.practice} />
    </li>
  );
}

export function DashboardView({ overview, now = new Date() }: DashboardViewProps) {
  if (overview.courses.length === 0) {
    return (
      <section className="card">
        <h2>No courses yet</h2>
        <p>
          Enrol in a course to see your progress here. <Link href="/courses">Browse courses</Link>
        </p>
      </section>
    );
  }
  return (
    <>
      {overview.resume ? <ResumeCard resume={overview.resume} /> : null}
      <h2>Your courses</h2>
      <ul className="cards progress-cards">
        {overview.courses.map((course) => (
          <CourseProgress key={course.slug} course={course} now={now} />
        ))}
      </ul>
    </>
  );
}
