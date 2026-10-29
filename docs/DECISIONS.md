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

### D-010 · 29 Oct 2026 · Overnight autonomy: merge reviewed, green PRs

- **Context:** the user asked for non-stop work overnight, with decisions made on their behalf.
- **What:** each slice gets its own branch and PR. It is merged to `main` (squash) only after a review pass and green CI, and the next slice starts from `main`.
- **Why:** this avoids a tall stack of dependent PRs. Any merge can be undone with `git revert`.

### D-011 · 29 Oct 2026 · Auth lives in the API at `/api/auth` (Better Auth 1.7)

- **What:** the web app calls the API cross-origin with `credentials: "include"`. Cookies are SameSite=Lax, which works because localhost:3000 and localhost:4000 are the same _site_.
- **Production constraint:** web and API must share a registrable domain (e.g. `pragya.ai` + `api.pragya.ai`). Mobile (Expo) will use Better Auth's bearer/expo plugin, not cookies.
- **Origin check:** Better Auth's origin/CSRF check is forced on (`disableOriginCheck: false`). The library turns it off when `NODE_ENV=test`, which would have hidden a regression.

### D-012 · 29 Oct 2026 · Sign-in methods and policies

- **Methods:** email + password, and mobile OTP via the phone-number plugin. Google turns on when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set.
- **Phone-only accounts:** verifying an OTP creates the account. The user gets a placeholder email `<digits>@phone.pragya.invalid`, because `.invalid` is guaranteed unroutable. The UI shows "Signed in with mobile" instead of that address.
- **Number entry:** a 10-digit number (optionally with a leading 0) is read as an Indian mobile (+91). Other countries need a `+` prefix.
- **Passwords:** 10–128 characters.
- **OTPs:** 6 digits, valid 5 minutes, 3 attempts.
- **Sessions:** 30 days, refreshed daily.
- **Rate limit:** `/api/auth/*` allows 20 requests per minute per IP, on top of the global limit.
- **Email verification:** always required in production. Elsewhere it is opt-in (`AUTH_REQUIRE_EMAIL_VERIFICATION`).

### D-013 · 29 Oct 2026 · Dev mail/SMS senders until providers are chosen

- **What:** verification links, reset links and OTPs are written to the API log in development. `createDevSenders` throws in production, so a missing provider fails at startup instead of silently dropping messages.
- **Planned providers:** Resend or SES for email, MSG91 for SMS (PLAN.md §3).

### D-014 · 29 Oct 2026 · Operator bootstrap via CLI

- **What:** `pnpm --filter @pragya/db grant-role --email … --role superadmin [--scope type:id]` grants roles to an existing account. `pnpm --filter @pragya/db seed` migrates the database and upserts the launch streams. Both are idempotent.
- **Why:** the first superadmin needs a path that does not go through the API.

### D-015 · 29 Oct 2026 · Phone column renamed with two migrations

- **What:** `users.phone` became `phone_number`, plus `phone_number_verified`, for Better Auth. drizzle-kit can only resolve a rename interactively, and nothing is in production yet, so it ships as a drop migration (0001) followed by an add migration (0002).

### D-016 · 29 Oct 2026 · Auth hardening from the security review

- **Log-only senders need explicit opt-in:** set `AUTH_DEV_SENDERS=true`. A staging deploy with an unusual `NODE_ENV` therefore can't silently write live OTPs or reset links to its logs. The setting is refused in production.
- **Request logs redact one-time credentials:** `token`, `code` and `otp` parameters and reset-password path tokens are masked.
- **Better Auth sees the client IP that Fastify trusts:** the bridge deletes client-supplied `X-Forwarded-For`, `X-Real-IP` and `Forwarded` headers and sets the address itself. Better Auth's rate limits and session IPs can't be spoofed.
- **`.invalid` email addresses are rejected at sign-up and change-email:** this stops anyone claiming a phone account's placeholder address.
- **`grant-role` refuses unverified emails:** pass `--allow-unverified` to override, locally only. It also prints the user id, so the operator can confirm who received the grant.
- **Still open:** a per-phone daily OTP cap in front of the SMS provider, to limit SMS-pumping cost. This comes with the MSG91 integration.

## Open questions

1. Platform commission %, and whether it differs for institute-sourced vs marketplace sales.
2. Whether institute teachers can also sell publicly, and who owns that content.
3. App-store purchase policy: allow store IAP (RevenueCat), or keep the mobile app as a reader for content bought on the web (the Kindle model)?
4. Live classes: native, or Zoom/Meet links for v1?
5. Domain and brand: pragya.ai / pragya.academy availability, logo and palette.
6. Hosting at launch: self-hosted VPS (Coolify) vs managed MySQL (RDS / PlanetScale).
7. Languages: English in v1 with a Hindi glossary, and when the full Hindi UI arrives.
8. Guest access to the AI tutor: small quota or teaser only?
9. **Where is the book pipeline's source data?** The earlier draft refers to `build.py`, a 1,430-question bank, weightage tiers and per-chapter assets, but none of these is on this machine. `~/Projects/Harshmohan-10` holds EPUBs of the published textbook. That book is copyrighted and this repository is public, so none of it is imported. The pack-builder is built against a schema with a small original sample pack, and the real bank plugs in once its location is known.
