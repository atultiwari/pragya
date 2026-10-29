# Pragya — AI-powered LMS: master plan

Version 0.1 · 29 Oct 2026 · Status: draft for discussion. Decisions and open questions live in [DECISIONS.md](DECISIONS.md); the earlier single-app draft is in [reference/](reference/APP_FEATURE_PLAN-2026-10-27.md).

## Context

Dr. Tiwari wants a modern, AI-powered and AI-assisted LMS that grows from **AI-powered MBBS lectures, starting with Pathology**, to **AI in Healthcare** and later to non-medical streams. It has to run on web, mobile and desktop from one TypeScript codebase on Node.js and React/Next.js, with MySQL as the database.

The earlier draft ([reference/APP_FEATURE_PLAN-2026-10-27.md](reference/APP_FEATURE_PLAN-2026-10-27.md), 27 Oct 2026) was a single-publisher learning app: Expo plus Supabase/Postgres, with content packs and a reader, assessments, games and SRS. This plan widens it into a multi-tenant, multi-tutor **marketplace LMS** with these additions:
- hierarchical roles (superadmin, institute nodal officers, teachers, students, guests)
- multiple streams and courses
- tutor and course rankings
- student leaderboards
- Razorpay payments with tutor payouts
- AI built into every role's workflow

The useful parts of the earlier draft are kept: content packs, block-based reader, chapter dashboard, sims as HTML bundles, the assessment and game engine, SRS and offline-first mobile.

**Decisions already made (29 Oct):** the project is named **Pragya**. Platforms are **Next.js (web) + Expo (iOS/Android) + Tauri (desktop)**. The business model is **marketplace + institutes**: independent tutors get a revenue share, and institutes buy B2B licences. Video is **hybrid**: YouTube for free content, Bunny Stream for paid content.


## 1. Product scope

**Streams → Courses → Modules → Lessons → Blocks.** A *stream* is a catalogue grouping (Medical/MBBS, Healthcare AI, later Engineering, Commerce and so on). A *course* is owned by one or more tutors and can be public (marketplace), institute-private, or both. Lesson blocks reuse the content-pack block types from the earlier draft:
- paragraph, table and figure
- flowchart (SVG)
- callout
- video ref
- sim ref
- quiz-pool ref
- glossary term
- PYQ box

First courses:
1. **AI-powered MBBS Pathology**: seeded from the existing book pipeline, with 1,430 questions, weightage tiers and per-chapter assets.
2. **AI in Healthcare**.
3. Non-medical courses later, to prove the system is subject-independent.

## 2. Roles, tenancy and permissions

| Role | Scope | Key powers |
|---|---|---|
| **Superadmin** | Platform | Everything: streams, institutes, tutor approval, pricing rules, revenue split, AI quotas, moderation, refunds, audit |
| Platform staff (content reviewer, finance, support) | Platform | Subsets of superadmin, such as course review/publish, payouts and refunds, and user support |
| **Institute nodal officer** | One institute | Onboard teachers and students (CSV/invite codes), create batches/sections, assign courses, buy and allocate seat licences, view institute analytics and leaderboards |
| **Teacher / tutor** | Own courses, plus assigned institute batches | Author courses (with AI assist), live/recorded lectures, assessments, grade, analytics and Q&A; independent tutors also get an earnings dashboard |
| **Student** | Enrolments | Learn, practise, take exams, AI tutor, leaderboards, reviews |
| **Guest** | None | Browse the catalogue, free preview lessons, a limited AI tutor, local-only progress that merges on sign-up |

There is also an optional *teaching assistant* role (a course-scoped grader) later.

**Model:** scoped RBAC. `role_assignments(user_id, role, scope_type[platform|institute|course|batch], scope_id)`. A user can hold several roles, for example a teacher who is also a student elsewhere, and switches between them with a "context switcher". Permissions are checked in one policy module (`packages/authz`) shared by the API and the UIs. Tenant isolation is enforced in the repository layer: every institute-scoped query takes `institute_id` from the session, never from the request body.

**Login flows:**
- email + password
- phone OTP (MSG91)
- Google and Apple sign-in
- institute SSO later (SAML/OIDC)
- invite links and codes for institute onboarding
- 2FA required for superadmin and finance staff

Tutors go through a verification flow (KYC, PAN/bank details for payouts, profile review).

## 3. Architecture

**Monorepo:** pnpm + Turborepo, all TypeScript (strict).

```
pragya/
  apps/
    web/        Next.js 15 (App Router): public catalogue (SEO), student, tutor, institute and admin portals as route groups
    mobile/     Expo (expo-router): student-first, plus a light tutor/institute view; offline packs, native video
    desktop/    Tauri v2 shell around the web build, with offline cache and windowed exam mode
    api/        Node service (Fastify + tRPC for TS clients + OpenAPI REST for webhooks/3rd parties)
    worker/     BullMQ workers: AI jobs, transcoding hooks, emails, payouts, leaderboard rollups
  packages/
    db/             Drizzle ORM schema + migrations (MySQL 8.4 LTS), repositories
    authz/          roles, permissions and policy checks
    contracts/      Zod schemas and tRPC routers' input/output types
    ui/             design system (Tamagui or NativeWind + shadcn for web) with shared tokens
    renderer/       lesson block renderer (web + native)
    assessment/     question selection, SRS (FSRS), scoring, blueprint assembler (pure TS)
    ai/             provider abstraction, prompts, RAG, usage metering
    sims/           HTML sim widgets + postMessage bridge SDK
    payments/       Razorpay client, webhook verification, ledger helpers
  tools/pack-builder/  extends the existing build.py output into validated course packs
  content/mbbs-pathology/
  docs/
```

**Data and infrastructure:**
- **MySQL 8.4**: the system of record, with InnoDB, utf8mb4 and row-level `institute_id` scoping. Drizzle with mysql2 is used for type safety and migrations.
- **Redis**: sessions and rate limits, BullMQ queues, and leaderboards (sorted sets).
- **Qdrant**: vector store for RAG, because MySQL community edition has no ANN vector index.
- **Meilisearch**: catalogue and course full-text search. Mobile offline search uses SQLite FTS5 in each downloaded pack.
- **Object storage**: S3-compatible (Cloudflare R2 or MinIO on the VPS) for packs, figures and uploads.
- **Video**: Bunny Stream (HLS, signed URLs, per-user watermark) for paid content and YouTube embeds for free content.
- **Auth**: Better Auth (MySQL/Drizzle adapter; organisations, 2FA and phone OTP plugins).
- **Notifications**: email (Resend/SES), SMS/WhatsApp (MSG91 / Gupshup) and push (Expo push).
- **Deploy**: Docker on the existing Coolify/VPS setup, with staging and production. Expo EAS handles store builds, and Tauri updater handles desktop.
- **Observability**: Sentry, OpenTelemetry and structured logs (pino).

## 4. Feature pillars

### 4.1 Catalogue and courses
- Stream and category browse, search and filters (stream, level, price, rating, language, tutor).
- Course page: syllabus, preview lessons, tutor card, ratings breakdown, outcomes, competencies (CBME codes for MBBS), price and coupons.
- Course types: self-paced, cohort/batch (with schedule) and institute-assigned.
- Versioned publishing: draft → review (platform staff) → published. Students stay on the version they started, with opt-in update.

### 4.2 Learning experience (from the earlier draft)
Learning features:
- Reader ("eBook+") with highlights, notes and bookmarks synced across devices, glossary pop-ups, cross-refs, "Asked in" chips, revision mode and dark mode.
- Chapter/module dashboard with exam radar (weightage), mastery per topic and recommended next.
- Video player with transcript, AI chapters, notes at a timestamp, speed control and resume.
- Interactive simulations: HTML bundles in a WebView or iframe through the widget registry (parameter explorer, virtual microscope, drag-and-drop labelling, sequence builder, branching case, lab-report interpreter).
- Offline-first mobile: downloaded packs work without the network, and progress syncs later.

### 4.3 Assessment
- Question types: MCQ, scenario MCQ, multi-select, FIB, true/false, image hotspot, matching, SAQ/LAQ (descriptive) and case-based.
- Practice, quizzes, assignments and timed mock exams from **blueprints** (RUHS 2019/2024, NEET-PG style).
- Proctoring-lite: question/option shuffle, server-side timing, tab-switch logging, and desktop exam mode in Tauri (full screen, blocks shortcuts).
- SRS (FSRS) over flashcards and missed questions, plus an exam-date revision planner.
- Certificates on completion, with a verifiable URL and QR code.

### 4.4 AI layer (AI-powered and AI-assisted)

The provider abstraction is in `packages/ai`, with Claude as the default (latest models, configurable per feature) and a fallback provider. Every call is logged to `ai_usage` (user, feature, tokens, cost) and capped by quotas per role or plan.

| For | Feature |
|---|---|
| Student | **AI tutor** ("Ask this lesson/course"): RAG over the course content only, with citations to lesson/topic ids and a refusal outside scope |
| Student | AI evaluation of descriptive answers against a rubric (strengths/gaps, never a bare score), Explain-why coaching, viva/oral-exam practice by voice |
| Student | Personalised study plan, weak-topic detection, auto flashcards and summaries |
| Tutor | **Course authoring copilot**: outline → lesson drafts → figures prompts → question generation with difficulty/Bloom tags, always human-reviewed before publish |
| Tutor | Lecture pipeline: upload video → transcription → AI chapters, summary, notes and quiz suggestions |
| Tutor | Grading assist for descriptive answers (suggested marks + rationale, tutor confirms) and Q&A reply drafts |
| Nodal officer | Institute insights in natural language ("which batches are falling behind in haematology?"), at-risk student alerts |
| Superadmin | Review/content moderation (toxicity, plagiarism of course content), anomaly detection on leaderboards and payments |

**Safety:** medical-content disclaimers, a citation-required answer mode, prompt-injection guards on user-uploaded content, no PHI, and human review for anything AI-generated that gets published.

### 4.5 Ratings and rankings
- **Course reviews**: only from verified enrolments with at least 20% progress; one review per course, editable; tutors can reply; reviews are moderated.
- **Course rank score**: Bayesian average rating, with a prior of m = 10 ratings at the platform mean, blended with completion rate and recent activity. Used for catalogue sorting and the "Top courses in stream" list.
- **Tutor rating**: the rating-count-weighted mean of the Bayesian scores of their published courses, plus learner count and response-time badges. Shown on the tutor profile, with tutor rankings per stream.
- Recomputed by a worker every night, with incremental updates on new reviews.

### 4.6 Gamification and leaderboards
- XP comes from lessons, quizzes, daily challenge, streaks and games (crossword, matching, rapid-fire, CTF case lab, from the earlier draft).
- **Leaderboards**: scopes are global, stream, course, institute and batch; periods are daily-challenge, weekly, monthly and all-time. They use Redis sorted sets with nightly snapshots to MySQL. Students use an anonymous handle by default and can opt in to their real name.
- Badges (for example organ-system badges) and shareable badge cards.
- Anti-cheat: server-side scoring for ranked modes, time-boxed challenges, outlier detection.

### 4.7 Payments (Razorpay)
- **B2C**: one-time course purchase, bundles, subscriptions (Razorpay Subscriptions, for example "All Pathology" monthly), coupons, and free preview.
- **B2B**: institutes buy seat packs and allocate seats to batches; invoices are paid by Razorpay payment link or bank transfer.
- **Book QR/scratch codes** unlock the matching course, carried over from the earlier draft.
- **Tutor payouts**: Razorpay Route (linked accounts). Each sale is split by the platform commission configured per tutor or course. Payouts are held through a refund window (for example 7 days) and settled automatically.
- Mobile in-app purchase rules are handled with **RevenueCat** for store purchases of digital content where required, and Razorpay on web/desktop (follows Apple/Google policy; decision to confirm).
- An **append-only financial ledger** (`ledger_entries`), idempotent webhook handling (signature verified, event id dedupe), GST-compliant invoices, refunds and reconciliation reports.

### 4.8 Communication
Announcements per course or batch, course Q&A threads (tutor plus AI draft replies), notifications (in-app, push, email, WhatsApp), and a live-class link integration (Zoom/Meet) for cohorts. Native live streaming is out of scope for v1.

### 4.9 Analytics
- Student: progress, mastery and time.
- Tutor: enrolments, revenue, drop-off per lesson, question item analysis (difficulty and discrimination).
- Institute: batch comparisons, attendance/engagement, exportable reports.
- Platform: GMV, take rate, cohort retention, AI cost per active user.

## 5. Core data model (MySQL, first cut)

| Area | Tables |
|---|---|
| Identity | `users`, `accounts` / `sessions` (Better Auth), `role_assignments` |
| Tenancy | `institutes`, `batches`, `batch_members` |
| Catalogue | `streams`, `courses`, `course_versions`, `course_tutors` (revenue share %), `modules`, `lessons`, `lesson_blocks` (JSON), `media_assets` |
| Learning | `enrollments` (source: purchase / institute / code / free), `lesson_progress`, `notes_highlights` |
| Assessment | `question_bank`, `question_tags`, `assessments`, `assessment_items`, `attempts`, `attempt_answers`, `srs_cards` |
| Social | `reviews`, `review_replies`, `course_stats`, `tutor_stats` |
| Gamification | `xp_events`, `badges`, `user_badges`, `leaderboard_snapshots` |
| Commerce | `products` / `prices`, `coupons`, `orders`, `payments`, `refunds`, `subscriptions`, `licences` (institute seats), `unlock_codes`, `ledger_entries`, `payouts`, `invoices` |
| AI | `ai_conversations`, `ai_messages`, `ai_usage`, `ai_quotas`, `content_embeddings_index` (pointer to Qdrant) |
| Operations | `audit_log`, `notifications` |

Conventions:
- ULID primary keys stored as `BINARY(16)`.
- `created_at` / `updated_at` on every table.
- Soft delete only where the law or business requires it.
- Money stored as integer paise.
- Every tenant-scoped table indexes `institute_id`.

## 6. Delivery phases (each phase ships something usable)

| Phase | Scope | Proves |
|---|---|---|
| **0 Foundation** (2–3 wk) | Monorepo, CI, MySQL/Drizzle, Better Auth with all roles, authz package with tests, design system, pack-builder for Pathology Ch 1–4 | Plumbing and tenancy |
| **1 MVP: Pathology on web** (6–8 wk) | Catalogue, course pages, reader, video (hybrid), practice MCQ/FIB, mock exam, Razorpay one-time purchase, guest mode, student dashboard, superadmin console, basic AI tutor (RAG + citations) | Students pay for and learn Pathology |
| **2 Institutes and tutors** | Institute onboarding (nodal officer, batches, seat licences, CSV import), tutor portal with the AI authoring copilot, review/publish workflow, reviews and ratings, Razorpay Route payouts, ledger and invoices | Marketplace and B2B work |
| **3 Mobile and engagement** | Expo app (offline packs, SRS, native video, push), leaderboards, XP/badges, daily challenge, games, certificates | Daily use |
| **4 AI depth and second course** | Descriptive-answer grading, lecture AI pipeline, viva practice, institute insights, sims (3–4 widgets), **AI in Healthcare** course | AI moat and subject independence |
| **5 Desktop and scale** | Tauri app with exam mode, subscriptions/bundles, SSO, first non-medical stream, Hindi UI | Breadth |

## 7. Non-functional requirements
- **Security**: OWASP ASVS L2. Every endpoint has rate limits, Zod validation and authz checks. CSRF protection on the web, a secrets manager, an audit log of privileged actions, signed media URLs and per-user video watermarks.
- **Compliance**: India's **DPDP Act 2023**, which means consent, data export and delete, and a grievance officer. GST invoicing. RBI rules for recurring payments (e-mandate through Razorpay).
- **Performance**: catalogue pages SSG/ISR, p95 API under 300 ms, leaderboards read from Redis only.
- **Accessibility**: WCAG 2.2 AA, a dyslexia-friendly font option and full keyboard support in exam mode.
- **Testing**: TDD with at least 80% coverage. Unit tests use Vitest. Integration tests run the API against MySQL in Testcontainers. Authz has a matrix test (every role × every action × own/foreign tenant). Razorpay webhooks have contract tests. E2E uses Playwright (web) and Maestro (mobile) for the critical flows: sign-up → purchase → learn → quiz → leaderboard, institute onboarding, and tutor publish → payout.

## 8. Open questions (to evolve in discussion; recorded in DECISIONS.md)
1. Platform commission percentage, and whether it differs for institute-sourced vs marketplace sales.
2. Whether institute teachers can also sell publicly, and who owns that content.
3. App-store purchase policy: allow store IAP, or keep the mobile app to "reader for purchased content" (the Kindle model)?
4. Whether live classes need to be native, or whether Zoom/Meet links are enough for v1.
5. Domain and brand (pragya.ai / pragya.academy availability), logo and colours.
6. Hosting budget: self-hosted VPS (Coolify) vs managed MySQL (PlanetScale/RDS) at launch.
7. Languages: English v1 with Hindi glossary, and when the full Hindi UI arrives.
8. Whether guests get the AI tutor (quota) or only a teaser.

