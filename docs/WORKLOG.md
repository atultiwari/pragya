# Work log

A record of autonomous work sessions: what shipped, what was decided (see DECISIONS.md) and what is next.

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
