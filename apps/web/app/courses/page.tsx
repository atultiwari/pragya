import type { Metadata } from "next";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { publicApi } from "@/lib/trpc";

export const metadata: Metadata = { title: "Courses · Pragya" };
export const dynamic = "force-dynamic";

async function loadCourses() {
  try {
    return {
      ok: true as const,
      page: await publicApi.catalogue.listCourses.query({ pageSize: 50 }),
    };
  } catch {
    return { ok: false as const };
  }
}

export default async function CoursesPage() {
  const result = await loadCourses();
  return (
    <main className="page">
      <h1>Courses</h1>
      {!result.ok ? (
        <p role="alert" className="form-error">
          Courses could not be loaded right now. Please try again shortly.
        </p>
      ) : result.page.items.length === 0 ? (
        <p className="muted">No courses are published yet.</p>
      ) : (
        <ul className="cards">
          {result.page.items.map((course) => (
            <li key={course.slug} className="card">
              <p className="tag">{course.stream.name}</p>
              <h2 className="card-title">
                <Link href={`/courses/${course.slug}`}>{course.title}</Link>
              </h2>
              {course.summary ? <p>{course.summary}</p> : null}
              <p className="muted">
                {course.lessonCount} lessons · {formatPrice(course.pricePaise)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
