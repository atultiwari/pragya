import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CompletionToggle, type CompletionState } from "./CompletionToggle";

const render = (state: CompletionState, busy = false) =>
  renderToStaticMarkup(<CompletionToggle state={state} busy={busy} onChange={() => undefined} />);

/** Finds the first <button> in a rendered element tree, so its onClick can be called directly. */
function findButton(node: ReactNode): ReactElement<{ onClick: () => void }> | null {
  if (!isValidElement(node)) return null;
  if (typeof node.type === "function") {
    return findButton((node.type as (p: unknown) => ReactNode)(node.props));
  }
  if (node.type === "button") return node as ReactElement<{ onClick: () => void }>;
  const children = (node.props as { children?: ReactNode }).children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findButton(child);
    if (found) return found;
  }
  return null;
}

describe("CompletionToggle", () => {
  it("renders nothing while the state loads", () => {
    expect(render("loading")).toBe("");
  });

  it("offers to mark an unfinished lesson complete", () => {
    const html = render("incomplete");
    expect(html).toContain("Mark as complete");
    expect(html).not.toContain("Lesson complete");
  });

  it("shows a saving state while busy", () => {
    const html = render("incomplete", true);
    expect(html).toContain("Saving…");
    expect(html).toContain("disabled");
  });

  it("shows a finished lesson and lets the learner undo it", () => {
    const html = render("complete");
    expect(html).toContain("Lesson complete");
    expect(html).toContain("Mark as not complete");
  });

  it("reports a failed save and still lets the learner retry", () => {
    const html = render("error");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Mark as complete");
  });

  it("calls back with the new completion state", () => {
    const onChange = vi.fn();
    findButton(
      <CompletionToggle state="incomplete" busy={false} onChange={onChange} />,
    )?.props.onClick();
    findButton(
      <CompletionToggle state="complete" busy={false} onChange={onChange} />,
    )?.props.onClick();
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });
});
