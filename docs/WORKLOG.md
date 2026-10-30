# Work log

A record of autonomous work sessions: what shipped, what was decided (see DECISIONS.md) and what is next.

## 30 Oct 2026, student dashboard slice

Asked to: build the next Phase 1 slice, a student dashboard (lesson progress, practice accuracy, continue where you left off).

### Shipped (branch `feat/student-dashboard`)

- **DB:** `lesson_progress` table (migration 0005, indexes created before the foreign keys so MySQL reuses them). `createProgressRepository`: mark or unmark a lesson, enrolled courses with lessons completed / total and the next lesson, and practice accuracy per course and lesson from `question_attempts`.
- **API:** `progress.lesson`, `progress.markComplete` (through `loadReadableLesson`) and `dashboard.overview` (signed-in only, each course re-checked with `can(course.read)`).
- **Web:** `/dashboard` with a resume card, per-course progress bars and a per-lesson accuracy table. "Mark as complete" at the end of each lesson. Dashboard and Account links in the nav when signed in.
- **Verified in a browser:** empty dashboard, free enrolment, marking a lesson complete (it persists across reloads), a practice answer showing up as per-lesson accuracy, and the resume card pointing at the next lesson. Checked at phone width and in dark mode.

### Decisions taken on the user's behalf

D-026 in DECISIONS.md.

### Suggested next steps

1. Razorpay checkout, once the commission question (open question 1) is answered and test keys are available.
2. Spaced repetition and a "review your mistakes" queue built on `question_attempts`.
3. Server-side "last opened lesson" tracking, if "continue" should resume reading position rather than the next unfinished lesson.

## 29–30 Oct 2026, overnight session

Asked to: continue with the next steps of the plan, keep working, make decisions as needed and document them.

### Shipped

1. **PR #1, Phase 0 foundation** (merged): monorepo, authz, MySQL schema, API, web and CI.
2. **Auth slice** (branch `feat/auth-better-auth`):
   - Better Auth with email + password and mobile OTP, optional Google.
   - Sessions in MySQL.
   - The API resolves each caller's subject from the session plus their stored role grants.
   - Web sign-up, sign-in (email or mobile OTP) and account pages.
   - Seed and `grant-role` CLIs.
   - Verified in a browser: sign-up, sign-out, wrong password, OTP sign-in, and a superadmin grant taking effect (`admin.ping` 403 → 200).

### Decisions taken on the user's behalf

D-010 to D-015 in DECISIONS.md.
