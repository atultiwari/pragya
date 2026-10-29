import { marked, type Token, type Tokens } from "marked";
import { blockSchema, CALLOUT_VARIANTS, type Block } from "./blocks.js";

export type ParseResult =
  | { readonly ok: true; readonly blocks: readonly Block[] }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Fenced blocks that embed structured widgets; their body is JSON for the matching block type. */
const EMBED_LANGS = new Set(["video", "sim", "quiz"]);
const ALERT = /^\[!([A-Za-z]+)\][ \t]*(.*)$/;

type Step = { readonly block?: unknown; readonly error?: string };

const preview = (raw: string): string => JSON.stringify(raw.trim().slice(0, 40));

function fromBlockquote(token: Tokens.Blockquote): Step {
  const [firstLine = "", ...rest] = token.text.split("\n");
  const alert = ALERT.exec(firstLine.trim());
  if (!alert) return { block: { type: "callout", variant: "note", text: token.text.trim() } };
  const variant = (alert[1] ?? "").toLowerCase();
  if (!(CALLOUT_VARIANTS as readonly string[]).includes(variant)) {
    return { error: `unknown callout "[!${alert[1]}]"; use one of ${CALLOUT_VARIANTS.join(", ")}` };
  }
  const title = (alert[2] ?? "").trim();
  return {
    block: { type: "callout", variant, ...(title ? { title } : {}), text: rest.join("\n").trim() },
  };
}

function fromParagraph(token: Tokens.Paragraph): Step {
  const [only, ...others] = token.tokens;
  if (only?.type === "image" && others.length === 0) {
    const image = only as Tokens.Image;
    return {
      block: {
        type: "figure",
        src: image.href,
        alt: image.text,
        ...(image.title ? { caption: image.title } : {}),
      },
    };
  }
  return { block: { type: "paragraph", text: token.text.trim() } };
}

function fromCode(token: Tokens.Code): Step {
  const lang = (token.lang ?? "").trim();
  if (!EMBED_LANGS.has(lang)) return { error: `unsupported fenced block "${lang || "plain"}"` };
  try {
    const body: unknown = JSON.parse(token.text);
    return { block: { ...(body as object), type: lang } };
  } catch {
    return { error: `the ${lang} block must contain valid JSON` };
  }
}

function toStep(token: Token): Step | null {
  switch (token.type) {
    case "space":
    case "hr":
      return null;
    case "heading": {
      const { depth, text } = token as Tokens.Heading;
      if (depth === 1)
        return {
          error:
            "level-1 heading found; the lesson title comes from the manifest, use ## for sections",
        };
      return { block: { type: "heading", level: Math.min(depth, 4), text: text.trim() } };
    }
    case "paragraph":
      return fromParagraph(token as Tokens.Paragraph);
    case "list": {
      const list = token as Tokens.List;
      return {
        block: {
          type: "list",
          ordered: list.ordered,
          items: list.items.map((item) => item.text.trim()),
        },
      };
    }
    case "table": {
      const table = token as Tokens.Table;
      return {
        block: {
          type: "table",
          header: table.header.map((cell) => cell.text),
          rows: table.rows.map((row) => row.map((cell) => cell.text)),
        },
      };
    }
    case "blockquote":
      return fromBlockquote(token as Tokens.Blockquote);
    case "code":
      return fromCode(token as Tokens.Code);
    case "html":
      return { error: `raw HTML is not allowed (${preview(token.raw)})` };
    default:
      return { error: `unsupported Markdown element "${token.type}" (${preview(token.raw)})` };
  }
}

/**
 * Converts a lesson's Markdown into validated content blocks. Every problem is reported,
 * numbered by block, so authors can fix a chapter in one pass.
 */
export function parseLessonMarkdown(markdown: string): ParseResult {
  const blocks: Block[] = [];
  const errors: string[] = [];
  marked.lexer(markdown).forEach((token, index) => {
    const step = toStep(token);
    if (step === null) return;
    if (step.error !== undefined) {
      errors.push(`block ${index + 1}: ${step.error}`);
      return;
    }
    const parsed = blockSchema.safeParse(step.block);
    if (parsed.success) blocks.push(parsed.data);
    else
      errors.push(
        `block ${index + 1}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "block"} ${i.message}`).join("; ")}`,
      );
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, blocks };
}
