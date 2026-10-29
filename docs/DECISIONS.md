# Decision log

Each entry: date · decision · why · status. New decisions are appended; superseded ones are marked, not deleted.

## Accepted

### D-001 · 29 Oct 2026 · Name: **Pragya**

Sanskrit for "wisdom". It is short, brandable and not tied to medicine, so it still works for non-medical streams. (Fallback was "Vedant Academy".)

### D-002 · 29 Oct 2026 · Platforms: Next.js (web) + Expo (iOS/Android) + Tauri (desktop)

- **Why:** Next.js gives SEO for the public catalogue and one place for all the portals. Expo gives true native mobile with offline packs and native video. Tauri wraps the web build for desktop and adds a locked exam mode. Shared TypeScript packages (contracts, authz, assessment, AI, renderer) keep the logic in one place.
- **Supersedes:** the Expo-only and react-native-web approach of the 27 Oct draft.

### D-003 · 29 Oct 2026 · Database: MySQL 8.4 LTS (Drizzle ORM)

- **Why:** this is the user's requirement.
- **Consequence:** vector search goes to Qdrant, full-text catalogue search goes to Meilisearch, and Redis holds leaderboards and queues.
- **Supersedes:** the Supabase/Postgres backend of the 27 Oct draft.

### D-004 · 29 Oct 2026 · Business model: marketplace + institutes

Independent tutors publish courses and earn a revenue share, paid through Razorpay Route. Institutes buy seat licences and manage their own teachers and students through nodal officers.

### D-005 · 29 Oct 2026 · Video: hybrid hosting

Free and promotional videos use YouTube embeds. Paid lectures use Bunny Stream (HLS, signed URLs, per-user watermark).

### D-006 · 29 Oct 2026 · Carried over from the 27 Oct draft

- Lessons are block-based content packs, not PDFs.
- Sims are self-contained HTML bundles shown in a WebView or iframe.
- Mobile is offline-first.
- Guests can use the app first and merge their progress on sign-up.
- Leaderboards show an anonymous handle by default.
- Book QR codes deep-link to the chapter dashboard and unlock the course.

### D-007 · 29 Oct 2026 · IDs are ULIDs stored as `CHAR(26)`

- **Why:** they stay readable in SQL, logs and URLs, and sort by creation time. The space saved by `BINARY(16)` is not worth the conversion code at this scale.
- **Supersedes:** the `BINARY(16)` convention in PLAN.md §5.

### D-008 · 29 Oct 2026 · TypeScript pinned to 6.0.x

- **Why:** typescript-eslint supports `<6.1`, so the Go-based TypeScript 7 waits until the lint toolchain supports it.

### D-009 · 29 Oct 2026 · Platform roles are separate from scoped roles

- **What:** `tutor` is a platform-scoped role for verified marketplace tutors who may create public courses. `teacher` is scoped to an institute (may start institute courses) or to a course (may edit it).
- **Why:** this keeps marketplace onboarding (KYC, payouts) separate from institute staffing.
- **Also:** authorisation lives in `packages/authz`. Its context facts (published, preview, enrolled, owner) come from trusted server data, never from clients.

## Open questions

1. Platform commission %, and whether it differs for institute-sourced vs marketplace sales.
2. Whether institute teachers can also sell publicly, and who owns that content.
3. App-store purchase policy: allow store IAP (RevenueCat), or keep the mobile app as a reader for content bought on the web (the Kindle model)?
4. Live classes: native, or Zoom/Meet links for v1?
5. Domain and brand: pragya.ai / pragya.academy availability, logo and palette.
6. Hosting at launch: self-hosted VPS (Coolify) vs managed MySQL (RDS / PlanetScale).
7. Languages: English in v1 with a Hindi glossary, and when the full Hindi UI arrives.
8. Guest access to the AI tutor: small quota or teaser only?
