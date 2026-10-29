"use client";

import type { Block } from "@pragya/content";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BlockView } from "@/components/content/BlockView";
import { browserApi, contentAssetBase, errorCode } from "@/lib/trpc";

type Lesson = Awaited<ReturnType<typeof browserApi.catalogue.lesson.query>>;
type State =
  | { kind: "loading" }
  | { kind: "ready"; lesson: Lesson }
  | { kind: "locked" }
  | { kind: "missing" }
  | { kind: "error" };

interface LessonReaderProps {
  readonly courseSlug: string;
  readonly lessonSlug: string;
}

export function LessonReader({ courseSlug, lessonSlug }: LessonReaderProps) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    browserApi.catalogue.lesson
      .query({ courseSlug, lessonSlug })
      .then((lesson) => !cancelled && setState({ kind: "ready", lesson }))
      .catch((error: unknown) => {
        if (cancelled) return;
        const code = errorCode(error);
        setState({
          kind: code === "FORBIDDEN" ? "locked" : code === "NOT_FOUND" ? "missing" : "error",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [courseSlug, lessonSlug]);

  const back = <Link href={`/courses/${courseSlug}`}>← Back to the course</Link>;

  switch (state.kind) {
    case "loading":
      return <main className="page reader muted">Loading lesson…</main>;
    case "missing":
      return (
        <main className="page reader">
          <h1>Lesson not found</h1>
          {back}
        </main>
      );
    case "error":
      return (
        <main className="page reader">
          <p role="alert" className="form-error">
            This lesson could not be loaded. Please try again.
          </p>
          {back}
        </main>
      );
    case "locked":
      return (
        <main className="page reader">
          <h1>Enrol to continue</h1>
          <p className="lede">
            This lesson is part of the full course. Free preview lessons are open to everyone.
          </p>
          {back}
        </main>
      );
    case "ready": {
      const { lesson } = state;
      return (
        <main className="page reader">
          <p className="tag">
            <Link href={`/courses/${courseSlug}`}>{lesson.course.title}</Link>
          </p>
          <h1>{lesson.title}</h1>
          <article className="lesson-body">
            {(lesson.blocks as Block[]).map((block, index) => (
              <BlockView key={index} block={block} assetBase={contentAssetBase(courseSlug)} />
            ))}
          </article>
          <nav className="lesson-nav" aria-label="Lesson navigation">
            {lesson.previous ? (
              <Link href={`/courses/${courseSlug}/${lesson.previous.slug}`}>
                ← {lesson.previous.title}
              </Link>
            ) : (
              <span />
            )}
            {lesson.next ? (
              <Link href={`/courses/${courseSlug}/${lesson.next.slug}`}>{lesson.next.title} →</Link>
            ) : null}
          </nav>
        </main>
      );
    }
  }
}
