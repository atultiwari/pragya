import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { errorCode, publicApi } from "@/lib/trpc";
import { CourseAccess } from "./CourseAccess";

export const dynamic = "force-dynamic";

interface CoursePageProps {
  readonly params: Promise<{ slug: string }>;
}

async function loadCourse(slug: string) {
  try {
    return await publicApi.catalogue.course.query({ slug });
  } catch (error: unknown) {
    if (errorCode(error) === "NOT_FOUND" || errorCode(error) === "BAD_REQUEST") notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const course = await loadCourse((await params).slug);
  return { title: `${course.title} · Pragya`, description: course.summary ?? undefined };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const course = await loadCourse((await params).slug);
  return (
    <main className="page">
      <p className="tag">{course.stream.name}</p>
      <h1>{course.title}</h1>
      {course.summary ? <p className="lede">{course.summary}</p> : null}
      <p className="muted">{formatPrice(course.pricePaise)}</p>
      <CourseAccess slug={course.slug} />
      <h2>Contents</h2>
      {course.modules.map((module) => (
        <section key={module.slug} className="outline">
          <h3>{module.title}</h3>
          <ol>
            {module.lessons.map((lesson) => (
              <li key={lesson.slug}>
                <Link href={`/courses/${course.slug}/${lesson.slug}`}>{lesson.title}</Link>
                {lesson.isPreview ? <span className="tag"> · Free preview</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
