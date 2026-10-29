# Sample pack: General Pathology, cell injury

A **development sample**, written from scratch for this repository. It exercises every block type the pack-builder supports. It is not the course content: the real MBBS Pathology pack will come from the author's own question bank and chapter material (see DECISIONS.md, open question 9).

**Medical review needed:** a subject expert must review this text before it is shown to any learner.

```bash
pnpm --filter @pragya/pack-builder content check  ../../content/sample-pathology
pnpm --filter @pragya/pack-builder content import ../../content/sample-pathology --publish
```
