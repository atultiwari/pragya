import { describe, expect, it } from "vitest";
import { parseLessonMarkdown } from "./markdown.js";

describe("parseLessonMarkdown", () => {
  it("maps headings, paragraphs, lists and tables to blocks", () => {
    const md = [
      "## Causes",
      "",
      "Cell injury follows **hypoxia** most often.",
      "",
      "- Hypoxia",
      "- Toxins",
      "",
      "1. First",
      "2. Second",
      "",
      "| Feature | Reversible |",
      "| --- | --- |",
      "| Nucleus | Normal |",
    ].join("\n");
    expect(parseLessonMarkdown(md)).toEqual({
      ok: true,
      blocks: [
        { type: "heading", level: 2, text: "Causes" },
        { type: "paragraph", text: "Cell injury follows **hypoxia** most often." },
        { type: "list", ordered: false, items: ["Hypoxia", "Toxins"] },
        { type: "list", ordered: true, items: ["First", "Second"] },
        { type: "table", header: ["Feature", "Reversible"], rows: [["Nucleus", "Normal"]] },
      ],
    });
  });

  it("turns GitHub-style alerts into callouts and plain quotes into notes", () => {
    const md =
      "> [!CLINICAL] Bedside link\n> Troponin rises after necrosis.\n\n> Remember the sequence.";
    expect(parseLessonMarkdown(md)).toEqual({
      ok: true,
      blocks: [
        {
          type: "callout",
          variant: "clinical",
          title: "Bedside link",
          text: "Troponin rises after necrosis.",
        },
        { type: "callout", variant: "note", text: "Remember the sequence." },
      ],
    });
  });

  it("turns an image-only paragraph into a figure", () => {
    expect(parseLessonMarkdown('![Swollen cell](figures/swelling.svg "Hydropic change")')).toEqual({
      ok: true,
      blocks: [
        {
          type: "figure",
          src: "figures/swelling.svg",
          alt: "Swollen cell",
          caption: "Hydropic change",
        },
      ],
    });
  });

  it("reads video, sim and quiz embeds from fenced JSON blocks", () => {
    const md = [
      "```video",
      '{ "provider": "youtube", "videoId": "dQw4w9WgXcQ" }',
      "```",
      "```quiz",
      '{ "poolRef": "cell-injury" }',
      "```",
    ].join("\n");
    expect(parseLessonMarkdown(md)).toEqual({
      ok: true,
      blocks: [
        { type: "video", provider: "youtube", videoId: "dQw4w9WgXcQ" },
        { type: "quiz", poolRef: "cell-injury" },
      ],
    });
  });

  it("collects every problem instead of stopping at the first", () => {
    const md = [
      "# Title",
      "",
      "<div>raw</div>",
      "",
      "```video",
      "not json",
      "```",
      "",
      "```python",
      "x = 1",
      "```",
    ].join("\n");
    const result = parseLessonMarkdown(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(4);
    expect(result.errors[0]).toMatch(/level-1 heading/);
    expect(result.errors[1]).toMatch(/raw HTML/);
    expect(result.errors[2]).toMatch(/video.*JSON/);
    expect(result.errors[3]).toMatch(/unsupported fenced block "python"/);
  });

  it.each([
    ["inline HTML in a paragraph", "Text <img src=x onerror=alert(1)> here", /inline HTML/],
    ["inline HTML in a list item", "- safe\n- <b>bold</b>", /inline HTML/],
    ["inline HTML in a table cell", "| A |\n| --- |\n| <span>x</span> |", /inline HTML/],
    ["a javascript: link", "[click](javascript:alert(1))", /link .*javascript/],
    ["a data: link in a callout", "> [!NOTE]\n> [x](data:text/html,hi)", /link .*data:/],
    ["an inline image", "See ![x](figures/x.svg) inline", /inline image/],
  ])("rejects %s", (_label, md, message) => {
    const result = parseLessonMarkdown(md);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(message);
  });

  it("allows http, https and mailto links", () => {
    const md = "[a](https://example.org) [b](http://example.org) [c](mailto:help@example.org)";
    expect(parseLessonMarkdown(md).ok).toBe(true);
  });

  it("still returns the blocks that parsed when others fail", () => {
    const result = parseLessonMarkdown("# Title\n\n![Cell](figures/cell.svg)");
    expect(result.ok).toBe(false);
    expect(result.blocks).toEqual([{ type: "figure", src: "figures/cell.svg", alt: "Cell" }]);
  });

  it("reports schema violations inside embeds", () => {
    const result = parseLessonMarkdown('```video\n{ "provider": "vimeo", "videoId": "x" }\n```');
    expect(result.ok).toBe(false);
  });
});
