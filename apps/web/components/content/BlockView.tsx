import type { Block } from "@pragya/content";
import { PracticeQuiz } from "../practice/PracticeQuiz";
import { Inline } from "./Inline";

interface BlockViewProps {
  readonly block: Block;
  /** URL prefix for this pack's figures, e.g. /content/<course-slug>. */
  readonly assetBase: string;
  /** Where the block sits; interactive blocks (quizzes) need it to talk to the API. */
  readonly lesson?: { readonly courseSlug: string; readonly lessonSlug: string };
}

function Placeholder({ label, detail }: { readonly label: string; readonly detail: string }) {
  return (
    <aside className="block-placeholder">
      <strong>{label}</strong>
      <span>{detail}</span>
    </aside>
  );
}

function Video({ block }: { readonly block: Extract<Block, { type: "video" }> }) {
  if (block.provider !== "youtube") {
    return <Placeholder label="Video" detail="This lesson video plays in the Pragya app." />;
  }
  const start = block.startSeconds ? `?start=${block.startSeconds}` : "";
  return (
    <div className="video-frame">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${block.videoId}${start}`}
        title="Lesson video"
        loading="lazy"
        allow="encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

export function BlockView({ block, assetBase, lesson }: BlockViewProps) {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as const;
      return (
        <Tag>
          <Inline text={block.text} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p>
          <Inline text={block.text} />
        </p>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List>
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </List>
      );
    }
    case "table":
      return (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {block.header.map((cell, i) => (
                  <th key={i} scope="col">
                    <Inline text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "callout":
      return (
        <aside className={`callout callout-${block.variant}`}>
          {block.title ? (
            <p className="callout-title">
              <Inline text={block.title} />
            </p>
          ) : null}
          <p>
            <Inline text={block.text} />
          </p>
        </aside>
      );
    case "figure":
      return (
        <figure>
          {/* Pack figures are static files; next/image optimisation adds nothing for SVG. */}
          <img src={`${assetBase}/${block.src}`} alt={block.alt} loading="lazy" />
          {block.caption ? <figcaption>{block.caption}</figcaption> : null}
        </figure>
      );
    case "video":
      return <Video block={block} />;
    case "sim":
      return (
        <Placeholder label="Interactive simulation" detail={`"${block.ref}" will appear here.`} />
      );
    case "quiz":
      return lesson ? (
        <PracticeQuiz
          courseSlug={lesson.courseSlug}
          lessonSlug={lesson.lessonSlug}
          poolRef={block.poolRef}
        />
      ) : (
        <Placeholder label="Practice questions" detail="Open this lesson to practise." />
      );
  }
}
