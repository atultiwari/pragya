import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Inline } from "./Inline";

const html = (text: string) => renderToStaticMarkup(<Inline text={text} />);

describe("Inline", () => {
  it("renders emphasis, code and line breaks", () => {
    expect(html("**bold** and *italic* and `code` and ~~gone~~")).toBe(
      "<strong>bold</strong> and <em>italic</em> and <code>code</code> and <del>gone</del>",
    );
  });

  it("renders safe links as external links", () => {
    expect(html("[Robbins](https://example.org)")).toBe(
      '<a href="https://example.org" target="_blank" rel="noopener noreferrer">Robbins</a>',
    );
  });

  it("drops the href of unsafe links instead of rendering them", () => {
    expect(html("[x](javascript:alert(1))")).toBe("<span>x</span>");
  });

  it("escapes anything that looks like markup", () => {
    expect(html("a <img src=x onerror=alert(1)> b")).not.toContain("<img");
    expect(html("5 < 6 & 7 > 3")).toBe("5 &lt; 6 &amp; 7 &gt; 3");
  });

  it("renders nested emphasis", () => {
    expect(html("**bold *and italic***")).toBe("<strong>bold <em>and italic</em></strong>");
  });
});
