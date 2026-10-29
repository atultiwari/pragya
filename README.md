# Pragya

An AI-powered, AI-assisted learning platform for web, mobile and desktop. Pragya starts with **AI-powered MBBS lectures (Pathology)** and **AI in Healthcare**, then grows to other streams, including non-medical ones. It brings together:
- a multi-tutor marketplace with course and tutor rankings
- institute spaces run by nodal officers
- student leaderboards
- Razorpay payments
- an AI tutor and an AI authoring copilot built into every role's workflow

**Status:** planning. No application code yet.

- [Master plan](docs/PLAN.md): scope, roles, architecture, features, data model, phases
- [Decision log](docs/DECISIONS.md): what is decided and what is still open
- [Earlier feature draft (27 Oct 2026)](docs/reference/APP_FEATURE_PLAN-2026-10-27.md)

**Stack (planned):**
- Next.js + Expo + Tauri on a pnpm/Turborepo monorepo
- Node API (Fastify + tRPC)
- MySQL 8.4 (Drizzle), Redis, Qdrant and Meilisearch
- Bunny Stream for video
- Razorpay for payments
