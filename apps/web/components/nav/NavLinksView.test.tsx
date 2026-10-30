import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NavLinksView } from "./NavLinksView";

const render = (signedIn: boolean | null) =>
  renderToStaticMarkup(<NavLinksView signedIn={signedIn} />);

describe("NavLinksView", () => {
  it("links a signed-in learner to their dashboard and account", () => {
    const html = render(true);
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/account"');
    expect(html).not.toContain('href="/sign-in"');
  });

  it("offers sign-in and sign-up to guests", () => {
    const html = render(false);
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain('href="/sign-up"');
    expect(html).not.toContain('href="/dashboard"');
  });

  it("shows only the catalogue while the session loads", () => {
    const html = render(null);
    expect(html).toContain('href="/courses"');
    expect(html).not.toContain('href="/dashboard"');
    expect(html).not.toContain('href="/sign-in"');
  });
});
