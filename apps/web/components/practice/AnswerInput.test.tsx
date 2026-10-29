import type { LearnerQuestion } from "@pragya/assessment";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnswerInput } from "./AnswerInput";

const options = [
  { id: "a", text: "Pyknosis" },
  { id: "b", text: "Karyolysis" },
];
const render = (question: LearnerQuestion, draft = {}, disabled = false) =>
  renderToStaticMarkup(
    <AnswerInput
      question={question}
      draft={draft}
      disabled={disabled}
      onChange={() => undefined}
    />,
  );

describe("AnswerInput", () => {
  it("renders one radio per option for single-answer questions, marking the choice", () => {
    const html = render({ id: "q", format: "mcq", stem: "?", options }, { choice: "b" });
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).toContain("Karyolysis");
    expect(html).toMatch(/checked=""[^>]*\/>Karyolysis/);
  });

  it("renders checkboxes for multi-select", () => {
    const html = render(
      { id: "q", format: "multi_select", stem: "?", options },
      { choices: ["a"] },
    );
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
  });

  it("renders True and False choices", () => {
    const html = render({ id: "q", format: "true_false", stem: "?" }, { value: true });
    expect(html).toContain("True");
    expect(html).toContain("False");
  });

  it("renders a text box for fill-in-the-blank and a text area for descriptive answers", () => {
    expect(render({ id: "q", format: "fib", stem: "?" }, { text: "liver" })).toContain(
      'value="liver"',
    );
    expect(render({ id: "q", format: "why", stem: "?" })).toContain("<textarea");
  });

  it("disables the inputs once answered", () => {
    expect(render({ id: "q", format: "mcq", stem: "?", options }, {}, true)).toContain("disabled");
  });
});
