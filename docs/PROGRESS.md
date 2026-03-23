# PulsCI Progress Tracker

Last updated: 2026-03-23

## Current State

PulsCI is a working CI/CD diagnostics product connected to Neteera's production Jenkins (jenkins.neteera.com). It runs via Docker Compose (Postgres + API + Worker + Frontend) on the CEO's machine.

### What's Live
- **632 jobs** crawled every 60 seconds
- **738 builds** synced
- **72 builds analyzed with AI** (Claude Haiku via AWS Bedrock)
- **286 health snapshots** recorded
- **$0.66 total AI spend** (~$0.009/build)
- Frontend at localhost:8090, API at localhost:3000

### Infrastructure
- Monorepo: packages/shared (analysis engine, 39 tests) + packages/api (Fastify + graphile-worker) + packages/frontend (React + Mantine)
- Auth: better-auth with email/password
- DB: PostgreSQL 16, Drizzle ORM, 16 tables (12 app + 4 auth)
- Worker: graphile-worker with 5 tasks (crawl, sync, analyze, health, schedule)
- AI: Claude Haiku via AWS Bedrock (SSO temp credentials, need refresh)
- Deployment: Docker Compose, Node 24

### User: Heinan (CEO)
- Email: heinan.c@neteera.com
- Org: Neteera (id: 48b51605-ebdf-4495-aefc-ec370803879e)
- Instance: Production Jenkins (id: a7c3bf47-4af3-4b07-96b6-1eb22f733c96)

---

## Phase Completion

### Week 0: Solo Scaffold ✅
- pnpm monorepo, shared package extracted, Fastify skeleton, Drizzle schema, Docker Compose

### Phase 1: Backend Foundation ✅
- Credential vault (AES-256-GCM)
- CI instance CRUD + test connection
- Jenkins proxy through backend
- Auth (better-auth, serverFactory bypass for Fastify)
- Crawl scheduler (graphile-worker, 60s cron)
- Build sync worker
- Build analysis worker (regex + AI)
- Health snapshot worker
- Dashboard/failures/health API endpoints
- Frontend: login, dashboard, failures, health pages
- Vite proxy removed, all calls through TIG API

### Phase 1.1: AI Analysis ✅
- Claude Haiku via AWS Bedrock
- Log noise filtering (strips Maven downloads, Pipeline scaffolding, etc.)
- Build context detection (React/CRA vs Java/Spring Boot)
- AI prompt: finds root cause not symptoms, suggests runnable commands
- Cost tracking per analysis (tokens + USD)
- Log insight: shows noise % on failure cards

### Quick Wins (unplanned) ✅
- Jenkins links on every failure ("Open in Jenkins")
- All/Code/Infra filter on failures page
- Copy fix command button
- Failure count badge on sidebar nav
- Flat dark UI (killed gradients)
- 3-day default time window on failures
- AI cost badge in header

---

## Phase 2: Teams + Trends (IN PROGRESS)

### Done
- ✅ AI analysis (was planned for Week 7, pulled forward)

### Remaining
- ❌ Team CRUD API + folder pattern matching
- ❌ Team-scoped failures view (devs see only their team's builds)
- ❌ Trends API + charts (failure rate over time, DORA metrics)
- ❌ Executive summary view (for VP Eng / managers)
- ❌ RBAC enforcement (admin/member/viewer)
- ❌ Multi-instance support
- ❌ "Flag for pattern review" button

### Not Started
- Phase 3: Alerts + SSO + First-run
- Phase 4: Scale + Pattern Intelligence

---

## Known Issues
- AWS SSO temp credentials expire — need manual refresh for AI analysis
- Old builds (>2 weeks) may 404 when fetching logs from Jenkins (log rotation)
- UI needs designer — functional but generic (engineer feedback captured in memory)
- No E2E test patterns (Cypress/Playwright) — AI handles it but no fast regex classification
- Health history is a list of badges, not a chart

---

## Key Architecture Decisions
- AI-first: regex classifies fast, AI extracts specifics. Never hand-tune extractors.
- Log noise stripping: removes known noise before sending to AI. Cheaper + more accurate.
- No Redis: PostgreSQL handles everything including job queue (graphile-worker).
- better-auth for auth (Lucia deprecated March 2025).
- Bottleneck rate limiter inside jenkins-crawler.ts, not at queue layer.
- Full log sent to AI after noise stripping (~40% of original), not truncated head/tail.

---

## Daily Plan Template

Morning:
1. CTO proposes 2-3 deliverables
2. CEO approves/modifies
3. Execute

End of day:
1. QA summary against plan
2. Update this file
3. Commit and push
