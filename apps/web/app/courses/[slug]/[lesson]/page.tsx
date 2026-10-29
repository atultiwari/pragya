import type { Metadata } from "next";
import { LessonReader } from "./LessonReader";

export const metadata: Metadata = { title: "Lesson · Pragya" };

interface LessonPageProps {
  readonly params: Promise<{ slug: string; lesson: string }>;
}

/** Lessons load in the browser so the API sees the learner's session cookie. */
export default async function LessonPage({ params }: LessonPageProps) {
  const { slug, lesson } = await params;
  return <LessonReader courseSlug={slug} lessonSlug={lesson} />;
}
