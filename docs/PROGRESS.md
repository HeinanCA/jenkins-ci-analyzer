# PulsCI Progress Tracker

Last updated: 2026-03-29

## Current State

PulsCI is a production-deployed CI/CD diagnostics platform at https://pulsci.neteera.com:8090
Connected to Neteera's production Jenkins. First real user (Cosmin) onboarded.

### Production Stats (as of 2026-03-29)
- **651 jobs** crawled every 60 seconds
- **825 builds** synced
- **101 builds analyzed with AI** ($0.90 total, ~$0.009/build)
- **5,381 health snapshots** recorded
- **100 tests** passing (39 shared + 20 api + 7 frontend + 34 misc)
- All 4 containers running 2+ days with zero restarts

### Infrastructure
- EC2: i-0aa61d24ba923c313 (shared with Jenkins/SonarQube)
- ALB: jenkins-internet-2023, HTTPS on port 8090
- Docker Compose: Postgres + API + Worker + Frontend (nginx)
- AWS credentials: EC2 instance profile (no static keys)
- AI: Claude Haiku via AWS Bedrock

### Security (Pentagon-grade)
- Postgres RLS on 12 tables with FORCE ROW LEVEL SECURITY
- Auth middleware resolves org + sets Postgres session variable
- SECURITY DEFINER functions for pre-auth queries
- scrypt KDF for credential vault
- SSRF protection with DNS resolution check
- Rate limiting on auth (10/15min per IP)
- Security headers (HSTS, CSP, X-Frame-Options)
- Containers: read-only fs, no-new-privileges, memory limits
- Sign-up disabled (invitation-only)

### Theme: Atmosphere (Warm Dark + Ember)
- Warm charcoal bg, cool slate glass cards
- Ember accent (#F56740) — distinctive, not AI-purple
- Plus Jakarta Sans, branded metric numbers
- Frosted glass cards with ember glow on hover
- Nav with icons, hover states, pulse animation on failure badge
- Failure accordion status bars (red=infra, ember=code)

---

## Completed Features

### Core Pipeline
- 3-pass log pipeline: noise filter -> structural dedup -> error-proximity extraction
- Result: 1.8M chars -> 55K chars, $0.14 -> $0.02 per analysis
- AI analysis: Claude Haiku via Bedrock, battle-tested prompt
- Regex pre-classification + AI extraction (AI-first principle)

### Pages
- Dashboard: stat cards, clickable failing jobs, health badge, hover effects
- Failures: AI summaries, code/infra classification, streak badges, source links, team filter
- Health: live executor view (agent, job, duration, stuck detection), sparkline, stats
- Trends: failure rate, MTTR, build frequency, classification, team filter, insight headers
- Teams: folder pattern picker, search, team CRUD

### Multi-tenancy
- Organization-scoped data access on every endpoint
- RLS policies on all org-scoped tables
- Workers propagate organizationId through job chain
- organizationId never accepted from client (derived from session)

---

## Backlog
- Invitation system (users can't self-register)
- Microsoft Teams webhook on failure state transitions
- More micro-interactions (designer feedback)
- Configurable stuck threshold per instance
- Queue detail view (what's waiting and why)
- Pagination on failures endpoint (cursor-based)

---

## Users
- heinan.c@neteera.com (admin, CEO)
- cosmin.stoian@neteera.com (admin, first external user)
