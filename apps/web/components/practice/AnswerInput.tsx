"use client";

import type { LearnerQuestion } from "@pragya/assessment";
import type { Draft } from "@/lib/practice";

interface AnswerInputProps {
  readonly question: LearnerQuestion;
  readonly draft: Draft;
  readonly disabled: boolean;
  readonly onChange: (draft: Draft) => void;
}

/** The input control for each question format; the parent owns the draft. */
export function AnswerInput({ question, draft, disabled, onChange }: AnswerInputProps) {
  const name = `answer-${question.id}`;
  switch (question.format) {
    case "mcq":
    case "scenario_mcq":
      return (
        <fieldset className="options" disabled={disabled}>
          <legend className="sr-only">Choose one answer</legend>
          {question.options.map((option) => (
            <label key={option.id} className="option">
              <input
                type="radio"
                name={name}
                checked={draft.choice === option.id}
                onChange={() => onChange({ choice: option.id })}
              />
              {option.text}
            </label>
          ))}
        </fieldset>
      );
    case "multi_select": {
      const chosen = draft.choices ?? [];
      const toggle = (id: string) =>
        onChange({
          choices: chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id],
        });
      return (
        <fieldset className="options" disabled={disabled}>
          <legend className="sr-only">Choose all that apply</legend>
          {question.options.map((option) => (
            <label key={option.id} className="option">
              <input
                type="checkbox"
                checked={chosen.includes(option.id)}
                onChange={() => toggle(option.id)}
              />
              {option.text}
            </label>
          ))}
        </fieldset>
      );
    }
    case "true_false":
      return (
        <fieldset className="options options-inline" disabled={disabled}>
          <legend className="sr-only">True or false</legend>
          {[true, false].map((value) => (
            <label key={String(value)} className="option">
              <input
                type="radio"
                name={name}
                checked={draft.value === value}
                onChange={() => onChange({ value })}
              />
              {value ? "True" : "False"}
            </label>
          ))}
        </fieldset>
      );
    case "fib":
      return (
        <input
          className="answer-text"
          aria-label="Your answer"
          value={draft.text ?? ""}
          disabled={disabled}
          maxLength={200}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      );
    default:
      return (
        <textarea
          className="answer-text"
          aria-label="Your answer"
          rows={4}
          value={draft.text ?? ""}
          disabled={disabled}
          maxLength={2000}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      );
  }
}
