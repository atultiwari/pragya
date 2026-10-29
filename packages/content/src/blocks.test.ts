import { describe, expect, it } from "vitest";
import { blockSchema } from "./blocks.js";

const ok = (block: unknown) => blockSchema.safeParse(block).success;

describe("blockSchema", () => {
  it.each([
    { type: "heading", level: 2, text: "Causes" },
    { type: "paragraph", text: "Cells **adapt** first." },
    { type: "list", ordered: false, items: ["Hypoxia", "Toxins"] },
    { type: "table", header: ["Feature", "Necrosis"], rows: [["Size", "Swollen"]] },
    { type: "callout", variant: "clinical", text: "Think of MI." },
    { type: "figure", src: "figures/necrosis.svg", alt: "Coagulative necrosis" },
    { type: "video", provider: "youtube", videoId: "dQw4w9WgXcQ", startSeconds: 30 },
    { type: "sim", ref: "starling-forces", params: { capillaryPressure: 35 } },
    { type: "quiz", poolRef: "cell-injury-overview" },
  ])("accepts %j", (block) => {
    expect(ok(block)).toBe(true);
  });

  it.each<[unknown, string]>([
    [{ type: "heading", level: 1, text: "Title" }, "h1 is reserved for the lesson title"],
    [{ type: "list", ordered: false, items: [] }, "empty list"],
    [{ type: "table", header: ["A", "B"], rows: [["only one"]] }, "ragged table row"],
    [{ type: "figure", src: "../secrets.png", alt: "x" }, "path traversal"],
    [{ type: "figure", src: "https://evil.example/x.png", alt: "x" }, "remote image"],
    [{ type: "figure", src: "figures/x.png", alt: "" }, "missing alt text"],
    [{ type: "video", provider: "youtube", videoId: "<script>" }, "bad video id"],
    [{ type: "callout", variant: "shout", text: "x" }, "unknown callout"],
    [{ type: "html", html: "<b>x</b>" }, "raw html"],
  ])("rejects %j (%s)", (block) => {
    expect(ok(block)).toBe(false);
  });
});
