# Writing a content pack

A pack is one course: a folder that `tools/pack-builder` validates and imports. See `content/sample-pathology` for a complete example.

```
my-pack/
  manifest.json          course metadata, modules, lesson order
  lessons/*.md           one Markdown file per lesson
  figures/*.svg|png      images referenced from lessons
  questions/*.json       question bank, one or more files
```

## manifest.json

```json
{
  "schemaVersion": 1,
  "id": "mbbs-pathology",
  "version": "1.0.0",
  "title": "MBBS Pathology",
  "streamSlug": "mbbs",
  "summary": "…",
  "pricePaise": 49900,
  "modules": [
    {
      "id": "cell-injury",
      "title": "Cell injury",
      "lessons": [
        {
          "id": "cell-injury-overview",
          "title": "Overview",
          "file": "lessons/01-overview.md",
          "isPreview": true
        }
      ]
    }
  ],
  "questionFiles": ["questions/cell-injury.json"]
}
```

- **Ids** are lower-case kebab-case and never change. Re-imports match lessons by id, so renaming an id creates a new lesson and drops learners' progress on the old one.
- **Version:** bump `version` (semver) for each release.
- **Price:** in paise (₹499 = `49900`). `0` means free.

## Lesson Markdown

| Write                                                    | Becomes                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| `## Heading` (also `###`, `####`)                        | heading. Don't use `#`: the title comes from the manifest.         |
| A paragraph, with `**bold**`, `*italic*`, `[links](…)`   | paragraph                                                          |
| `- item` / `1. item`                                     | list                                                               |
| A Markdown table                                         | table (every row needs a cell per column)                          |
| `> [!CLINICAL] Optional title` + text                    | callout. Variants: `clinical`, `memory`, `exam`, `note`, `warning` |
| `> plain quote`                                          | note callout                                                       |
| `![Alt text](figures/x.svg "Caption")` on its own line   | figure (alt text required; the file must exist in the pack)        |
| ` ```video ` `{ "provider": "youtube", "videoId": "…" }` | video embed (`youtube` or `bunny`)                                 |
| ` ```sim ` `{ "ref": "starling-forces", "params": {} }`  | interactive simulation                                             |
| ` ```quiz ` `{ "poolRef": "lesson-id-or-tag" }`          | quiz drawn from questions of that lesson or tag                    |

Raw HTML, remote images and other fenced code blocks are rejected.

## Questions

Every question has `id`, `lessonId` (a lesson in this pack), `format` and `stem`, plus optional `explanation`, `marks`, `yearsAsked`, `difficulty`, `tags`, and `flags.debatable` (a note shown next to the key).

| format                      | extra fields                                              |
| --------------------------- | --------------------------------------------------------- |
| `mcq`, `scenario_mcq`       | `options` (2–6, ids `a`–`f`), `answer`                    |
| `multi_select`              | `options`, `answers`                                      |
| `true_false`                | `answer` (boolean)                                        |
| `fib`                       | `answers` (accepted strings, compared case-insensitively) |
| `saq`, `laq`, `why`, `case` | `modelAnswer`                                             |

## Commands

```bash
pnpm build
pnpm --filter @pragya/pack-builder run content check  ../../content/my-pack
pnpm --filter @pragya/pack-builder run content build  ../../content/my-pack --out dist/my-pack.json
pnpm --filter @pragya/pack-builder run content import ../../content/my-pack --publish
```
