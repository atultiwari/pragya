import type { LearnerQuestion, ScoreResult } from "@pragya/assessment";

/** What the learner has entered so far; the shape matches the API's response for each format. */
export interface Draft {
  readonly choice?: string;
  readonly choices?: readonly string[];
  readonly value?: boolean;
  readonly text?: string;
}

const optionText = (question: LearnerQuestion, id: string): string =>
  "options" in question ? (question.options.find((o) => o.id === id)?.text ?? id) : id;

/** Turns the revealed key into a sentence for the learner. */
export function describeKey(question: LearnerQuestion, key: ScoreResult["key"]): string {
  if ("choice" in key) return optionText(question, key.choice);
  if ("choices" in key) return key.choices.map((id) => optionText(question, id)).join("; ");
  if ("value" in key) return key.value ? "True" : "False";
  if ("accepted" in key) {
    const [first, ...others] = key.accepted;
    return others.length ? `${first} (also accepted: ${others.join(", ")})` : (first ?? "");
  }
  return "modelAnswer" in key ? key.modelAnswer : "";
}

export function isAnswerReady(question: LearnerQuestion, draft: Draft): boolean {
  switch (question.format) {
    case "mcq":
    case "scenario_mcq":
      return draft.choice !== undefined;
    case "multi_select":
      return (draft.choices?.length ?? 0) > 0;
    case "true_false":
      return draft.value !== undefined;
    default:
      return (draft.text?.trim().length ?? 0) > 0;
  }
}

/** The response body the API expects for this format. */
export function toResponse(question: LearnerQuestion, draft: Draft): Draft {
  switch (question.format) {
    case "mcq":
    case "scenario_mcq":
      return { choice: draft.choice ?? "" };
    case "multi_select":
      return { choices: draft.choices ?? [] };
    case "true_false":
      return { value: draft.value ?? false };
    default:
      return { text: draft.text ?? "" };
  }
}
