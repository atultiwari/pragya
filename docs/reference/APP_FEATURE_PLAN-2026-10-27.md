# Learning App — Core Feature Plan (v0.1 draft, 27 Oct 2026)

Status: **draft for Dr. Tiwari's review**. Once approved, this becomes the brief handed to Claude Code (Stage 7).

## 1. Guiding decisions

1. **Subject-independent shell + content packs.** The app is a generic learning runtime. Everything specific to "RUHS MBBS Pathology" lives in a versioned *content pack*. "AI in Healthcare", "AI in Laboratory Medicine", Flow Cytometry notes, etc. become further packs on the same shell with no code changes.
2. **One codebase, three targets.** React Native + Expo (expo-router, react-native-web) → iOS, Android, and web. Already decided over Unity/Flutter so the book app and the game lab share a stack.
3. **Offline-first.** A downloaded pack is fully readable and quizzable without network; progress syncs when online. Indian student connectivity makes this non-negotiable.
4. **Content, not PDF.** Chapters are stored as structured blocks (the app JSON the build pipeline already emits), rendered natively. This is what makes search, highlights, cross-links, glossary pop-ups, and per-topic analytics possible — an EPUB/PDF viewer cannot do these well.
5. **The book and the app are one product.** The chapter QR codes already printed in the book deep-link into the app's chapter dashboard. Book buyers get the app's online resources; app users get pointers back to the book.
6. **Reuse the existing data.** Question bank (1,430 items, topic/NMC tags, repeat links, flags), weightage tiers (A/B/C), per-chapter assets (rapid revision, scenario MCQs, Explain-why) are the seed content. Nothing is re-authored for the app.

## 2. Content model (the reusable core)

```
Course (pack)           e.g. "MBBS Pathology — RUHS", "AI in Healthcare"
└─ Part                 e.g. General Pathology / Haematology / Systemic
   └─ Chapter           CH01 … CH37
      └─ Topic (unit)   4.1 Oedema … (the numbered sub-sections)
         └─ Blocks      paragraph · list · table · figure · flowchart(SVG) ·
                        callout(clinical/memory-hook) · pyq-box · glossary-term ·
                        sim(ref) · video(ref) · quiz-pool(ref) · cross-ref
```

Attached to the pack, keyed by topic id:
- **Question bank** — format (MCQ / scenario-MCQ / FIB / SAQ / LAQ / CASE / WHY), marks, years asked, key, explanation, flags (incomplete / debatable + note), repeat links, template (old / 2019 / 2024).
- **Weightage data** — per chapter and topic: recent-5-year marks share, tier, repeat count (Stage 4 output).
- **Competency map** — CBME-2024 codes per topic.
- **Glossary** — term → one-line definition → topic id (drives pop-ups and crosswords).
- **Flashcards** — generated from one-liners / rapid-revision.
- **Media manifest** — videos (YouTube id, type long/short, timestamps → topic), figures, sim bundles.
- **Exam blueprint** — how a mock paper is assembled (e.g. RUHS 2024: 20 MCQ [14 scenario + 6 direct], 10-mark essay, Explain-why 5×3, 11 × 5-mark notes incl. 1 AETCOM). A pack can carry several blueprints (2019 scheme, 2024 scheme, NEET-PG style).

Pack format: a zip of JSON + SVG/PNG + sim bundles with a `manifest.json` (id, version, min app version, size, checksums). Published to Supabase Storage/CDN; the app checks for updates and downloads deltas. The pack builder is an extension of the existing `build.py`.

**Subject-independence test:** every feature below must work from the pack alone. If a feature needs a "pathology" branch in app code, it goes into the pack schema instead.

## 3. Feature pillars

### 3.1 Reader ("eBook+")
Must-have
- Native block rendering with chapter → topic navigation, progress indicator, "continue where you left off".
- Highlights (4 colours), notes, bookmarks — synced across devices; export notes as Markdown/PDF.
- Full-text search across the pack (local index), filterable by chapter / block type (e.g. "tables only").
- Tap-to-define glossary terms; cross-references open in a bottom sheet without losing place.
- Figures: pinch-zoom, tap hotspots on labelled schematics, "show related question".
- Typography controls, dark mode, dyslexia-friendly font option.
- **"Asked in" chips** on every topic (years + marks) → tap to open those questions.
- Reading-list/"revision mode": shows only callouts, tables, flowcharts and rapid-revision (compressed view of a chapter for last-week revision).

Nice-to-have (later)
- Text-to-speech of a topic; Hindi glosses for key terms; print-page references ("Book p. 112") so book+app readers stay aligned.

### 3.2 Chapter dashboard
One screen per chapter, also the landing target of the printed QR code.
- **Exam radar**: recent-5-year marks share, tier-A topics, most-repeated questions, year heatmap — straight from Stage 4 data.
- **Your mastery**: per-topic score (from quizzes, SRS, games), confidence trend, time spent, last revised.
- **Recommended next**: weak × high-weightage topics first.
- Resource tiles: Read · Rapid revision · Videos · Simulations · Practice (MCQ/FIB/Explain-why) · Games · Past questions by year.
- Competencies covered (CBME-2024 codes) with "asked / never asked" marker.

Course-level home: overall progress, streak, exam countdown, today's revision queue, leaderboard snippet, "resume".

### 3.3 Interactive simulations
A **widget registry** of generic, subject-agnostic interaction types; a topic references one with parameters. Candidate types (each reusable in other courses):
| Widget | Pathology example | AI-course example |
|---|---|---|
| Parameter explorer (sliders → live diagram/graph) | Starling forces → oedema; coagulation cascade on/off factors | Learning rate / epochs → loss curve |
| Virtual microscope (zoom/pan annotated illustration, hotspots, "find the feature") | Caseous granuloma; MI at 1 day vs 1 week | Confusion-matrix explorer |
| Drag-and-drop labelling / sorting | Classify anaemias by MCV/RDW; sort thrombus vs post-mortem clot features | Sort ML tasks: classification vs regression |
| Sequence builder (order the steps) | Steps of acute inflammation; metastatic cascade | ML pipeline steps |
| Branching case (decision tree with consequences) | Shock case → fluids/vasopressors/antibiotics | Deploying a model: what to check first |
| Lab-report interpreter (enter values → interpretation) | CBC / LFT / coagulation profile | Metric calculator (sens/spec/PPV) |
| Timeline scrubber | Infarct morphology over days–weeks | — |

Implementation recommendation: author each sim as a **self-contained HTML/JS bundle** inside the pack, run in a WebView (mobile) / iframe (web), with a small postMessage bridge for score, completion and theme. Pros: Claude Code can build and test sims independently in a browser; they are truly subject-independent; the same bundle can be embedded in the website or an LMS. Con: slightly less "native" feel. (Native RN sims are the alternative for the 2–3 most-used widget types later.)

### 3.4 Assessment and games
Practice
- MCQ (direct and scenario), FIB, true/false, image-based (hotspot/figure-based) — pulled from the bank by topic/chapter/tier/year; instant explanation; "debatable" items show the intended key plus the note.
- Explain-why and short-note self-check: student answers (text or voice), then sees the model answer and a self-rating; optional AI marking in Phase 4.
- **Mock exams** assembled from blueprints (RUHS 2024 P-I/P-II, 2019 scheme, NEET-PG style), timed, with marks breakdown by chapter → feeds mastery.
- **Spaced repetition** (SM-2/FSRS) over flashcards and missed questions; a daily queue sized to the exam countdown.
- Past-paper mode: browse any paper year-wise exactly as set (uses the Stage 2 clean papers).

Games (engagement layer, all generated from pack data)
- Crossword (from glossary), word-search, matching pairs, "spot the odd one", rapid-fire 60-second quiz, "higher or lower" (which topic carries more marks).
- **CTF-style case lab** (carried over from the Clinical AI lab idea): multi-stage cases with "flags" to capture — correct diagnosis, correct next test, correct management — replayable with variants; difficulty ladders per organ system.
- Daily challenge (same 10 questions for everyone that day) → leaderboard fairness.

Scoring, leaderboards, badges
- Points with decay-free mastery score; XP for streaks.
- Leaderboards: daily challenge, weekly, all-time; filters: global / college / batch / friends. Anonymous handles by default; opt-in real name.
- **Organ-system badges** earned by case/quiz performance ("aspiring nephropathologist"), public shareable badge card (image for WhatsApp/Instagram) — doubles as marketing.
- Anti-cheat basics: server-side scoring for ranked modes, time-boxed daily challenge, per-attempt question shuffling.

### 3.5 Video
- Topic ↔ video mapping in the media manifest: long-form YouTube (embedded player) and Shorts, plus timestamp chapters that jump to the topic.
- "Watch" tile on every topic and chapter dashboard; watched state tracked; videos appear in revision recommendations.
- Production stays outside the app (Remotion/Hyperframes pipeline, voice clone) — the app only consumes IDs. Offline video is out of scope (YouTube terms); short MP4 explainers can be bundled in the pack later if needed.

### 3.6 Revision engine (ties it together)
- Exam-date planner: given exam date and chapters, builds a day-wise plan weighted by tier and personal weakness.
- Daily queue = SRS due cards + weak-topic questions + one game + one video.
- Weekly report (in-app and optional email).

### 3.7 Accounts, sync, entitlements
- Supabase auth (phone OTP, Google, Apple), **guest mode first** (local-only until sign-in, then merge).
- Progress/highlights/notes sync; conflict-free (last-write per item).
- Entitlements per pack: free preview chapters; unlock by in-app purchase (RevenueCat for stores, Razorpay on web), by **book QR/scratch code** (book buyers), or by institution licence (college bulk codes).
- Profile: college, batch, exam scheme — used for leaderboard filters and blueprint default.

### 3.8 Authoring and admin (for VRL)
- Pack builder CLI (extends `build.py`): chapter markdown + bank JSON + assets → validated pack (schema via Zod/JSON-Schema); CI publishes to storage with version bump and changelog.
- Admin web panel (Next.js, later): content updates, flag fixes (debatable keys), leaderboard moderation, analytics.
- **Learning analytics**: which questions/topics students fail most → feeds the next book edition and video priorities.

### 3.9 AI features (Phase 4, cost-controlled)
- "Ask this chapter": RAG tutor constrained to pack content with citations to topic ids; rate-limited; cached answers.
- Explain-why / short-note AI marking against the model answer with a rubric; returns strengths/gaps, never a bare score.
- Auto-generated variants of scenario MCQs for the daily challenge (reviewed before release).

## 4. Architecture sketch

- **Monorepo** (pnpm + Turborepo):
  - `apps/mobile` — Expo app (iOS/Android/web), expo-router, Zustand, TanStack Query, expo-sqlite (offline store + FTS5 search), react-native-svg, WebView.
  - `apps/admin` — Next.js admin (later).
  - `packages/content-schema` — pack schema + validators (shared by builder and app).
  - `packages/renderer` — block renderer components.
  - `packages/sims` — HTML sim widgets + bridge SDK.
  - `packages/game-engine` — question selection, SRS, scoring, blueprint assembler (pure TS, testable).
  - `tools/pack-builder` — the pipeline extension.
  - `content/mbbs-pathology` — the first pack (sourced from `work/`).
- **Backend**: self-hosted Supabase (Postgres + RLS, Storage, Edge Functions for ranked scoring, daily challenge, entitlement checks). Fits the existing Coolify/VPS setup.
- **Flowcharts**: Mermaid pre-rendered to SVG at pack-build time (no runtime Mermaid).
- **Theming**: pack-level accent colour/icon so each course feels distinct inside one app.

## 5. Phasing (each phase is a usable app)

| Phase | Scope | Proves |
|---|---|---|
| 0 | Pack schema + builder; Ch 1–4 pack; design system | Content model works end-to-end |
| 1 | Reader, chapter dashboard (radar + resources), practice MCQ/FIB, search, highlights/notes, guest mode, QR deep links | Core value: book + app |
| 2 | Auth + sync, SRS, mock exams from blueprints, past-paper mode, mastery tracking, exam planner | Daily-use revision tool |
| 3 | Games, daily challenge, leaderboards, organ badges, CTF case lab; videos; entitlements/purchase | Engagement + revenue |
| 4 | Sims (3–4 widget types), AI tutor/marking, admin panel, analytics; **second pack ("AI in Healthcare")** | Subject independence proven |

## 6. Decisions needed before hand-off

1. **Sims as WebView HTML bundles** (recommended) vs native RN components?
2. **Guest-first** with optional sign-in (recommended) vs sign-in required?
3. **Monetisation**: free preview + paid pack unlock + book-QR unlock — agreed? Price tiers later.
4. **Leaderboard identity**: anonymous handle default, college filter opt-in — agreed?
5. **Language**: English only in v1, Hindi glossary later — agreed?
6. **Web target in v1** (reader + practice on web from day one) or mobile first?
7. Should the chapter QR in the book point to the app's chapter dashboard (web URL that opens the app if installed)? This fixes the "placeholder URL" currently in the build.

## 7. Out of scope for v1
Live classes, discussion forums, peer help (shelved per earlier decision), offline video, institution LMS integrations (SCORM/LTI) — revisit after v1 ships.
