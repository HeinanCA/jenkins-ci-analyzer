# PulsCI Progress Tracker

Last updated: 2026-03-23 (end of day)

## Current State

PulsCI is a working CI/CD diagnostics product connected to Neteera's production Jenkins (jenkins.neteera.com). Runs via Docker Compose on the CEO's machine. Backend engineer said: "I would make PulsCI the default failure triage view for my team today."

### What's Live
- **632 jobs** crawled every 60 seconds
- **738 builds** synced
- **72 builds analyzed with AI** (Claude Haiku via AWS Bedrock)
- **286+ health snapshots** recorded
- **$0.66 total AI spend** (~$0.009/build average)
- **46 tests** passing (39 shared + 7 frontend)
- Frontend at localhost:8090, API at localhost:3000

### Infrastructure
- Monorepo: packages/shared + packages/api (Fastify + graphile-worker) + packages/frontend (React + Mantine)
- Auth: better-auth with email/password
- DB: PostgreSQL 16, Drizzle ORM, 16+ tables
- Worker: graphile-worker with 5 tasks (crawl, sync, analyze, health, schedule)
- AI: Claude Haiku via AWS Bedrock (SSO via ~/.aws mount, AWS_PROFILE)
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
- CI instance CRUD + test connection + setup flow
- Jenkins proxy through backend
- Auth (better-auth, serverFactory bypass for Fastify)
- Crawl scheduler (graphile-worker, 60s cron)
- Build sync worker
- Build analysis worker (regex + AI)
- Health snapshot worker
- Dashboard/failures/health/teams API endpoints
- Frontend: login, dashboard, failures, health, teams pages
- Vite proxy removed, all calls through TIG API

### Phase 1.1: AI Analysis ✅
- Claude Haiku via AWS Bedrock (SSO credentials via ~/.aws mount)
- Log noise filtering (strips Maven downloads, Pipeline scaffolding, etc.)
- Build context detection (React/CRA vs Java/Spring Boot passed to AI)
- AI prompt: finds root cause not symptoms, suggests runnable commands, always extracts file+line
- Cost tracking per analysis (tokens + USD)
- Log insight: shows noise % on failure cards
- AI offline detection: header warning + "regex" badge on degraded analyses
- Hard cap on filtered logs (500K chars) for Haiku context window

### Phase 2: Teams + Trends (IN PROGRESS)

#### Done
- ✅ AI analysis (pulled forward from Week 7)
- ✅ Teams CRUD API with glob pattern matching
- ✅ Team-scoped failures endpoint (?team_id= filter)
- ✅ Teams page: checkbox folder picker with search, indeterminate parents, removable badges
- ✅ Team filter dropdown on failures page
- ✅ GitHub source links using real git SHA from Jenkins BuildData API
- ✅ Failures grouped by job (streak badges, sorted by severity)
- ✅ Health sparkline bar chart
- ✅ Designer brief written (docs/DESIGNER-BRIEF.md)

#### Remaining
- ❌ Trends API + charts (failure rate over time, DORA metrics)
- ❌ Executive summary view (for VP Eng / managers)
- ❌ RBAC enforcement (admin/member/viewer)
- ❌ Multi-instance support
- ❌ "Flag for pattern review" button

### Not Started
- Phase 3: Alerts (Slack) + SSO + First-run
- Phase 4: Scale + Pattern Intelligence

---

## Code Quality (as of today)

### Tests
- packages/shared: 39 tests (pattern matcher, classifier, health calculator)
- packages/frontend: 7 tests (groupByJob)
- packages/api: 0 tests (needs integration tests)

### Theme Consistency
- Zero hardcoded hex in any component file (verified via grep)
- All colors from packages/frontend/src/theme/mantine-theme.ts
- Shared constants: colors, HEALTH_COLORS, cardStyle, codeStyle
- Primary color: violet (not blue)

### File Structure
- FailuresPage split into: types.ts, utils/group-by-job.ts, components/FailureDetail.tsx, components/SourceLink.tsx, FailuresPage.tsx
- Dashboard groups failures by job (consistent with Failures page)
- TeamsPage uses API client (no raw fetch)

---

## Known Issues
- AWS SSO credentials expire — ~/.aws is mounted but `aws sso login` still needed manually. No restart required after refresh.
- Old builds (>2 weeks) may 404 when fetching logs from Jenkins (log rotation)
- Streak count is total failures in time window, not truly consecutive (pass between failures doesn't reset)
- No flaky test detection
- Dashboard still shows individual builds from API (grouping done in frontend)
- Team filtering happens in app code, not SQL (fine for current scale, won't scale to 1000+ jobs)
- No Slack/webhook notifications (alertRules table exists but no implementation)
- sync-builds doesn't populate git_sha (only analyze-build does)

---

## Key Architecture Decisions
- AI-first: regex classifies fast, AI extracts specifics. Never hand-tune extractors.
- Log noise stripping: removes known noise before sending to AI. Cheaper + more accurate.
- No Redis: PostgreSQL handles everything including job queue (graphile-worker).
- better-auth for auth (Lucia deprecated March 2025).
- Bottleneck rate limiter inside jenkins-crawler.ts, not at queue layer.
- GitHub source links use git SHA from Jenkins BuildData action (not branch name guessing).
- Failures grouped by job in frontend (not API) — other consumers may want flat data.
- 3-day default time window on failures.

---

## Engineer Feedback Status (2026-03-23)

### Backend Engineer: "I would make PulsCI the default failure triage view for my team today"
- ✅ Group failures by job
- ✅ GitHub source links (exact SHA)
- ❌ Slack notifications (#1 next ask)
- ❌ Flaky test detection
- ❌ True consecutive streak

### Frontend Engineer: "No longer generic. It looks like a product someone built with intention"
- ✅ Grouped failures with streak
- ✅ Theme centralized, zero hardcoded hex
- ✅ Health sparkline
- ✅ Teams: search, indeterminate checkboxes, prefetch
- ✅ Sidebar violet accent border
- ✅ FailuresPage split into proper modules
- ✅ Dashboard grouped (consistent with Failures)
- ❌ Health period toggle (1h/24h/7d)

---

## Daily Plan Template

Morning:
1. CTO reads PROGRESS.md
2. CTO proposes 2 backend + 2 frontend deliverables
3. CEO approves/modifies
4. Execute

End of day:
1. QA summary against plan
2. Update this file
3. Commit and push
