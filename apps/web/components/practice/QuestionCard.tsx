"use client";

import type { LearnerQuestion, ScoreResult } from "@pragya/assessment";
import { useState } from "react";
import { describeKey, isAnswerReady, toResponse, type Draft } from "@/lib/practice";
import { browserApi } from "@/lib/trpc";
import { Inline } from "../content/Inline";
import { AnswerInput } from "./AnswerInput";

interface QuestionCardProps {
  readonly number: number;
  readonly question: LearnerQuestion;
  readonly where: { readonly courseSlug: string; readonly lessonSlug: string };
}

const isDescriptive = (q: LearnerQuestion) =>
  !["mcq", "scenario_mcq", "multi_select", "true_false", "fib"].includes(q.format);

function Verdict({
  result,
  question,
}: {
  readonly result: ScoreResult;
  readonly question: LearnerQuestion;
}) {
  const heading =
    result.correct === null ? "Model answer" : result.correct ? "Correct" : "Not quite";
  const tone = result.correct === null ? "neutral" : result.correct ? "right" : "wrong";
  return (
    <div className={`verdict verdict-${tone}`} role="status">
      <p className="verdict-title">{heading}</p>
      {result.correct !== true ? (
        <p>
          {result.correct === null ? null : <strong>Answer: </strong>}
          <Inline text={describeKey(question, result.key)} />
        </p>
      ) : null}
      {result.explanation ? (
        <p className="muted">
          <Inline text={result.explanation} />
        </p>
      ) : null}
      {result.debatable ? <p className="debatable">Note: {result.debatable}</p> : null}
      {result.correct === null ? (
        <p className="muted">Compare it with yours: what did you include or miss?</p>
      ) : null}
    </div>
  );
}

export function QuestionCard({ number, question, where }: QuestionCardProps) {
  const [draft, setDraft] = useState<Draft>({});
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await browserApi.practice.answer.mutate({
          ...where,
          questionId: question.id,
          response: toResponse(question, draft),
        }),
      );
    } catch {
      setError("Your answer could not be checked. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="question">
      <p className="question-stem">
        <span className="question-number">{number}.</span> <Inline text={question.stem} />
      </p>
      <AnswerInput
        question={question}
        draft={draft}
        disabled={result !== null || busy}
        onChange={setDraft}
      />
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {result ? (
        <Verdict result={result} question={question} />
      ) : (
        <button type="button" onClick={submit} disabled={busy || !isAnswerReady(question, draft)}>
          {busy ? "Checking…" : isDescriptive(question) ? "Show model answer" : "Check answer"}
        </button>
      )}
    </li>
  );
}
