import { Lexer, type Token, type Tokens } from "marked";
import type { ReactNode } from "react";

const SAFE_LINK = /^(https?:|mailto:)/i;

/**
 * Renders a block's inline Markdown (emphasis, code, links) to React elements. Nothing is
 * injected as HTML: unknown tokens fall back to their escaped text.
 */
function renderTokens(tokens: readonly Token[]): ReactNode[] {
  return tokens.map((token, index) => {
    switch (token.type) {
      case "strong":
        return <strong key={index}>{renderTokens((token as Tokens.Strong).tokens)}</strong>;
      case "em":
        return <em key={index}>{renderTokens((token as Tokens.Em).tokens)}</em>;
      case "del":
        return <del key={index}>{renderTokens((token as Tokens.Del).tokens)}</del>;
      case "codespan":
        return <code key={index}>{(token as Tokens.Codespan).text}</code>;
      case "br":
        return <br key={index} />;
      case "link": {
        const link = token as Tokens.Link;
        const children = renderTokens(link.tokens);
        // The pack-builder already rejects unsafe links; this is defence in depth.
        if (!SAFE_LINK.test(link.href.trim())) return <span key={index}>{children}</span>;
        return (
          <a key={index} href={link.href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      }
      case "text": {
        const text = token as Tokens.Text;
        return text.tokens ? renderTokens(text.tokens) : decodeEntities(text.text);
      }
      default:
        return decodeEntities(
          "text" in token && typeof token.text === "string" ? token.text : token.raw,
        );
    }
  });
}

/** marked escapes `<`, `>` and `&` in text; React escapes again, so decode once first. */
const decodeEntities = (text: string): string =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

export function Inline({ text }: { readonly text: string }) {
  return <>{renderTokens(Lexer.lexInline(text))}</>;
}
