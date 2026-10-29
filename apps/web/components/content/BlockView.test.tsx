import type { Block } from "@pragya/content";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockView } from "./BlockView";

const html = (block: Block) =>
  renderToStaticMarkup(<BlockView block={block} assetBase="/content/pack" />);

describe("BlockView", () => {
  it("renders headings at their level", () => {
    expect(html({ type: "heading", level: 3, text: "Causes" })).toBe("<h3>Causes</h3>");
  });

  it("renders ordered and unordered lists", () => {
    expect(html({ type: "list", ordered: true, items: ["a", "**b**"] })).toBe(
      "<ol><li>a</li><li><strong>b</strong></li></ol>",
    );
    expect(html({ type: "list", ordered: false, items: ["x"] })).toBe("<ul><li>x</li></ul>");
  });

  it("renders tables with a header row", () => {
    const out = html({
      type: "table",
      header: ["Feature", "Necrosis"],
      rows: [["Size", "*Swollen*"]],
    });
    expect(out).toContain('<th scope="col">Feature</th>');
    expect(out).toContain("<td><em>Swollen</em></td>");
  });

  it("renders callouts with their variant and title", () => {
    const out = html({
      type: "callout",
      variant: "clinical",
      title: "Bedside",
      text: "Troponin rises.",
    });
    expect(out).toContain('class="callout callout-clinical"');
    expect(out).toContain("Bedside");
    expect(out).toContain("Troponin rises.");
  });

  it("renders figures from the pack's asset base with alt text", () => {
    const out = html({
      type: "figure",
      src: "figures/cell.svg",
      alt: "A cell",
      caption: "Spectrum",
    });
    expect(out).toContain('src="/content/pack/figures/cell.svg"');
    expect(out).toContain('alt="A cell"');
    expect(out).toContain("<figcaption>Spectrum</figcaption>");
  });

  it("embeds YouTube through the privacy-enhanced domain", () => {
    const out = html({
      type: "video",
      provider: "youtube",
      videoId: "dQw4w9WgXcQ",
      startSeconds: 30,
    });
    expect(out).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30"');
    expect(out).toContain("title=");
  });

  it("shows placeholders for widgets that are not built yet", () => {
    expect(html({ type: "sim", ref: "starling-forces", params: {} })).toContain(
      "Interactive simulation",
    );
    expect(html({ type: "quiz", poolRef: "necrosis" })).toContain("Practice questions");
    expect(
      html({ type: "video", provider: "bunny", videoId: "0b1c2d3e-0000-4000-8000-000000000000" }),
    ).toContain("Video");
  });
});
