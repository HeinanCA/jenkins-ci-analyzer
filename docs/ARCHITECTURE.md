# That Infrastructure Guy (TIG) - System Architecture

Technical reference for engineers. See PRODUCT.md for vision, phases, and team structure.

---

## System Components

```
                                 +------------------+
                                 |   Jenkins (N)    |
                                 |   instances      |
                                 +--------+---------+
                                          |
                                   Jenkins JSON API
                                          |
+----------------+    REST API    +-------+--------+     +------------------+
|   React SPA    |<-------------->|   TIG API      |     |  TIG Worker      |
|   (Mantine)    |                |   (Fastify)    |<--->|  (graphile-worker)|
+----------------+                +-------+--------+     +--------+---------+
                                          |                       |
                                  +-------+--------+              |
                                  |  PostgreSQL     |<-------------+
                                  |  (via Drizzle)  |
                                  +----------------+
```

**TIG API** (Node.js + Fastify + TypeScript) - REST API for the frontend. Handles auth, RBAC, input validation. Proxies all Jenkins calls. Stateless, horizontally scalable.

**TIG Worker** (Node.js + graphile-worker) - Background jobs: crawl Jenkins, fetch logs, run analysis, health snapshots. Same codebase as API, separate process. **Imports from `shared/` and `db/` only — never from `routes/` or Fastify-specific code.** Boundary enforced in code review.

**Rate Limiting** - Lives inside `jenkins-crawler.ts`, NOT at the queue layer. Bottleneck (token bucket) limiter wraps every Jenkins API call, configured per CI instance (default: max 10 req/s, minTime 100ms). A single crawl job makes 50-200 HTTP requests — queue-level concurrency doesn't touch that.

**PostgreSQL** (via Drizzle ORM) - All persistent state. Also serves as job queue backend (graphile-worker) — no Redis dependency.

**React SPA** (evolved from POC) - Talks exclusively to TIG API. No direct Jenkins calls. Mantine, React Query, Zustand, Recharts.

**Redis** (future, if needed) - Added only when cache pressure is measurable. Not in default docker-compose.yml.

---

## Data Model

### Auth (better-auth managed)

> **Decision (Week 0):** Lucia v3 was deprecated March 2025. better-auth chosen instead — Drizzle-native, self-hosted, actively maintained, includes multi-tenancy and roles out of the box.

better-auth manages its own tables (user, session, account, verification) via Drizzle adapter. Mounted on Fastify at `/api/auth/*`.

### Application Tables

- **organizations** - id, name, slug (top-level tenant)
- **users** - id, org_id, email, display_name, role (admin/member/viewer). Linked to better-auth user table.
- **ci_instances** - id, org_id, name, provider, base_url, credentials (encrypted JSONB), crawl_config, last_crawl_at
- **teams** - id, org_id, ci_instance_id, name, folder_patterns (TEXT[] globs)
- **team_members** - team_id, user_id
- **jobs** - id, ci_instance_id, full_path, name, url, color, health_score, is_active
- **builds** - id, job_id, build_number, result, started_at, duration_ms, log_fetched
- **build_analyses** - id, build_id, classification, confidence, matches (JSONB), ai_summary, ai_root_cause, ai_suggested_fixes, ai_skipped_reason (enum: budget_exhausted/high_confidence_match/disabled/null)
- **health_snapshots** - id, ci_instance_id, level, score, agents_online, agents_total, executors_busy, executors_total, queue_depth, stuck_builds, issues (JSONB), recorded_at
- **alert_rules** - id, org_id, condition (JSONB), channels (JSONB), is_enabled
- **alert_events** - id, rule_id, triggered_at, payload, resolved_at
- **pattern_candidates** - id, ci_instance_id, build_analysis_id, proposed_name, proposed_category, proposed_patterns (JSONB), ai_confidence, flagged_by, flagged_at, status (pending/promoted/rejected), promoted_at, promoted_by

### Credentials
AES-256-GCM encrypted. Key from env var `TIG_ENCRYPTION_KEY`. Decrypted only in-memory.

### Logs
NOT stored in Postgres. Fetched on-demand from Jenkins, proxied through backend. Only analysis results persisted. No cache layer initially — Redis added if measured need arises. S3 retention is future premium.

---

## Analysis Pipeline

```
[Crawl Scheduler] -> [Job Discovery] -> jobs table
                          |
                     [Build Sync] -> builds table
                          |
                 [Log Fetch + Analyze] -> build_analyses table
                          |
                 [AI Analysis] -> ai_* columns (for Unknown/low-confidence)
```

- **Crawl:** per instance, configurable interval (default 60s), incremental (only new builds since last_crawl_at)
- **Analysis:** auto-triggered for failed/unstable builds. Pattern matcher + classifier ported from POC (pure functions).
- **AI:** fires when pattern match confidence < 0.7. Claude Haiku. Daily cap per instance (configurable, default 100). Per-instance, not per-org.
- **AI budget exhaustion:** `ai_skipped_reason` field distinguishes "Unknown (ran, no match)" from "budget exhausted (did not run)." Surfaced explicitly in UI. Admins see usage against cap in instance settings.
- **Unknown fallback:** when neither pattern match nor AI produces a classification, show raw log excerpt around failure point. Never a dead-end "Unknown" with nothing actionable.
- **Pattern contribution:** "Flag for pattern review" button on Unknown builds creates `pattern_candidates` row. Full promotion UI (review, dedup, dry-run, activation) in Phase 4.
- **Health:** snapshot every 60s, stored in Postgres for trending. Frontend reads latest snapshot directly.

---

## API Endpoints (all /api/v1)

**Auth:** POST /auth/login, /auth/oidc/callback, /auth/refresh. GET /auth/me.

**CI Instances:** CRUD at /instances. POST /instances/:id/test, /instances/:id/crawl.

**Jobs & Builds:** GET /instances/:id/jobs (?team_id, ?status). GET /jobs/:id/builds. GET /builds/:id (includes analysis). GET /builds/:id/log (proxied). GET /builds/:id/analysis.

**Dashboard:** GET /dashboard/summary, /dashboard/failures, /dashboard/trends (?period=7d).

**Health:** GET /instances/:id/health, /instances/:id/health/history (?period=24h).

**Teams:** CRUD at /teams. GET /teams/:id/jobs.

**Alerts:** CRUD at /alerts/rules. GET /alerts/events.

---

## Auth & Multi-Tenancy

- better-auth (self-hosted, Drizzle/Postgres native, multi-tenancy + roles built in). OIDC/SSO via better-auth plugin (Azure AD first).
- RBAC: admin (full), member (view + teams + alerts), viewer (read-only)
- Every query scoped by organization_id at repository layer
- Teams use configurable folder_patterns (glob matching)

---

## Monorepo Structure

```
tig/
  packages/
    shared/              # Analysis engine, types, Zod schemas (from POC)
      src/analysis/      # pattern-matcher, classifier, failure-patterns
      src/schemas/       # jenkins-api Zod schemas
      src/health/        # health-calculator
    api/                 # Fastify backend
      src/server.ts
      src/worker.ts
      src/db/schema.ts   # Drizzle schema
      src/routes/        # auth, instances, jobs, builds, dashboard, health, teams
      src/services/      # credential-vault, jenkins-crawler (Bottleneck), analysis-pipeline
      src/jobs/          # graphile-worker tasks (imports shared/ and db/ ONLY)
    frontend/            # React SPA (evolved from POC)
      src/api/tig-client.ts
      src/features/
  docker-compose.yml
  Dockerfile
  pnpm-workspace.yaml
```

---

## Key Decisions

| Decision | Choice | Why |
|---|---|---|
| Backend | Node.js/TypeScript | Same as frontend, analysis engine ports zero-rewrite |
| Framework | Fastify | Fast, schema validation, minimal abstraction |
| ORM | Drizzle | TS-native, readable SQL, plain migrations |
| Queue | graphile-worker | Postgres-backed. No Redis. One fewer service for self-hosted customers |
| Auth | better-auth | Self-hosted, Drizzle-native. Lucia deprecated March 2025. better-auth includes multi-tenancy + roles |
| Architecture | Monolith + Worker | Worker boundary: shared/ and db/ only. Split later if needed |
| Rate limiting | Bottleneck in jenkins-crawler.ts | Per-instance token bucket. Queue layer irrelevant to rate limiting |
| Logs | No cache, fetch on-demand | Redis added only if measured. S3 is future premium |
| Grouping | Configurable glob patterns | Folder-based only initially. Label/view-based is a known gap |
| AI | Claude Haiku, per-instance cap | Budget exhaustion explicit in UI, never silent |
| Patterns | AI-to-pattern promotion | Design partners contribute. Engine grows from production logs |

---

## Deployment

Docker Compose is the primary target. Ships with Postgres 16.

**External Postgres requirements:** 12+ with pgcrypto extension. AWS RDS and GCP Cloud SQL work out of the box. Azure Database for PostgreSQL requires manual extension enablement.

**Redis is not in the default deployment.** Postgres handles all workloads including health snapshots at 30s granularity and job queue.

---

## Known Limitations

- **Team scoping is folder-pattern-only.** Jenkins Views, labels, and flat naming conventions not supported. Known gap on roadmap.
- **Pattern catalog starts at 12 regex patterns.** Coverage partial for non-standard build toolchains. AI fallback and pattern contribution are expansion mechanisms.
- **No log retention.** Logs fetched on-demand, not stored. S3 retention is future work.
