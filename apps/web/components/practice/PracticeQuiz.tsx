"use client";

import type { LearnerQuestion } from "@pragya/assessment";
import { useEffect, useState } from "react";
import { browserApi } from "@/lib/trpc";
import { QuestionCard } from "./QuestionCard";

interface PracticeQuizProps {
  readonly courseSlug: string;
  readonly lessonSlug: string;
  readonly poolRef: string;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; questions: readonly LearnerQuestion[] }
  | { kind: "error" };

/** A lesson's embedded practice set; questions are scored by the API one at a time. */
export function PracticeQuiz({ courseSlug, lessonSlug, poolRef }: PracticeQuizProps) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    browserApi.practice.quiz
      .query({ courseSlug, lessonSlug, poolRef })
      .then(({ questions }) => !cancelled && setState({ kind: "ready", questions }))
      .catch(() => !cancelled && setState({ kind: "error" }));
    return () => {
      cancelled = true;
    };
  }, [courseSlug, lessonSlug, poolRef]);

  return (
    <section className="quiz" aria-label="Practice questions">
      <h2 className="quiz-title">Practice</h2>
      {state.kind === "loading" ? <p className="muted">Loading questions…</p> : null}
      {state.kind === "error" ? (
        <p role="alert" className="form-error">
          Practice questions could not be loaded.
        </p>
      ) : null}
      {state.kind === "ready" && state.questions.length === 0 ? (
        <p className="muted">No questions yet.</p>
      ) : null}
      {state.kind === "ready" ? (
        <ol className="question-list">
          {state.questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              number={index + 1}
              question={question}
              where={{ courseSlug, lessonSlug }}
            />
          ))}
        </ol>
      ) : null}
    </section>
  );
}
