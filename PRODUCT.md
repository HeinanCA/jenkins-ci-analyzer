# That Infrastructure Guy (TIG) - Product & Operating Plan

Owner: CTO. Updated quarterly. See ARCHITECTURE.md for technical reference.

---

## Why We're Building This

R&D engineers at a mid-size engineering org push code daily. When a build fails, they don't have Jenkins access, don't understand the pipeline structure, and don't know how to read raw logs. So they ping DevOps.

That ping costs both sides. The developer loses context and waits. The DevOps engineer stops what they're doing, opens Jenkins, reads a log that takes 30 seconds to interpret, and writes a Slack reply. This happens 5-15 times a day across a team. It's not a crisis - it's a slow, invisible tax on engineering velocity that nobody measures and nobody fixes.

**The current state:**

1. Developer pushes code
2. Build fails
3. Developer sees a red icon in GitHub/GitLab with no useful context
4. Developer messages DevOps: *"hey my build failed, what happened?"*
5. DevOps triages, explains, moves on
6. Repeat tomorrow

Existing tools solve adjacent problems but not this one. Jenkins UI exposes everything and explains nothing - it's built for the person who configured the pipeline, not the person running code through it. GitHub/GitLab status checks tell you pass/fail with no root cause. Datadog and Splunk monitor pipelines at infrastructure level - overkill for R&D and still require DevOps to configure and maintain. IDPs like Backstage and Port take months to implement and still require DevOps to author all the content.

None of them answer the question a developer actually asks: *"my build failed - what does that mean and what do I do now?"*

**TIG's specific value proposition:** translate CI/CD signal into developer language, scoped to the team that needs it, without requiring DevOps involvement.

---

## Who It's For

**Primary - the R&D developer**
Mid-level engineer. Writes application code. Understands Git, PRs, and deployment in concept but doesn't own or deeply understand the CI/CD pipeline. When something breaks, they want to know what failed, why, and what to do about it. They do not want to become a Jenkins expert. They want to ship.

**Secondary - the DevOps lead**
Owns the pipelines. Currently the single point of failure for all CI/CD questions. Wants R&D teams to be self-sufficient. Needs visibility into pipeline health across multiple instances and teams without babysitting each one. TIG is their force multiplier.

**Tertiary - the engineering manager or QA lead**
Doesn't touch pipelines at all. Needs to know: is the team shipping? Are there recurring failures? What's the trend? Needs read-only, plain-language answers - not dashboards built for engineers.

**The buyer (VP Engineering / CTO)**
Signs the contract. Speaks DORA - deployment frequency, lead time for changes, change failure rate, MTTR. The executive summary view (Phase 2) is the sell: recurring failure patterns trending down, build health improving over quarters. That's the ROI story.

---

## The Outcome We're Optimizing For

Two distinct SLAs:

> **Recurring use (the north star):** A developer whose build failed opens TIG and understands what broke, why, and what to do about it - in under 2 minutes, without asking anyone. This is a cache hit against pre-analyzed data.

> **First-run setup:** A DevOps lead connects a Jenkins instance and sees the first analyzed failures within 3-5 minutes. This includes initial crawl, build sync, and log analysis. Honest about the cold start.

Everything else - health snapshots, trends, RBAC, multi-instance - serves or supports that outcome. If a feature doesn't reduce that 2-minute window or reduce the number of DevOps pings, it's a nice-to-have.

---

## Go-to-Market: Design Partner Program

TIG does not go to general availability after Phase 4. It goes to 2-3 design partners first.

**Why:** Self-hosted means every customer has a different Jenkins version, network topology, SSO provider, and proxy setup. "docker compose up didn't work" is not a bug report - it's the default experience until proven otherwise in real environments.

**Design partners (Phase 1-4):**
- Neteera (your org, first customer, controlled environment)
- 1-2 external orgs recruited during Phase 2-3 (ideal: mid-size, Jenkins-heavy, willing to give feedback)

**What design partners get:** free access, direct Slack channel with you, hands-on setup assistance.

**What you get:** real environments to harden against, feedback on the Unknown classification gap, validation that folder-pattern scoping works beyond Neteera.

**GA criteria:** 3 design partners running in production for 4+ weeks with <5% Unknown classification rate and zero hand-holding on daily use.

The CTO and DevOps/Platform hire co-own design partner support. This is not an afterthought - it's the primary feedback loop.

---

## Implementation Phases

### Week 0: Solo Scaffold (CTO, before team starts)
Pre-team work. Must be complete before anyone is hired.

- pnpm monorepo with packages/shared, packages/api, packages/frontend
- Extract analysis engine from POC into packages/shared
- Fastify skeleton, Drizzle schema, Docker Compose
- Verify auth library compatibility (Lucia vs better-auth). Decision made here.
- `docker compose up` works, Postgres migrates, Fastify responds

**This is the artifact the backend hire joins into on Day 1.**

### Phase 1: Backend Foundation (Weeks 1-4)
No new features. Replace Vite proxy with real backend.

- Week 1: Backend hire ramps. Credential vault. CI instance CRUD. Jenkins proxy endpoints.
- Week 2: Local auth (Lucia, 1 day). Crawl scheduler (graphile-worker). Job discovery with Bottleneck rate limiter. **Designer delivers three core screen flows by end of Week 2** so frontend hire has specs to scaffold against.
- Week 3: Build sync. Jobs/builds API. Log proxy. Frontend hire begins component scaffolding against designer specs.
- Week 4: Frontend migrates SPA to TIG API. Auth flow. Remove Vite proxy. **Designer Week 4 review gate.**

**Ship:** docker compose up deploys working app with backend.

### Phase 2: Teams + Trends + AI Fallback (Weeks 5-8)
- Week 5: Team CRUD + UI, configurable folder patterns, team-scoped views. Executive summary view (DORA-adjacent metrics: change failure rate, MTTR, build frequency).
- Week 6: Auto-analysis pipeline, trends API + charts (failure rate, infra vs code ratio over time)
- Week 7: AI analysis as fallback for Unknown classifications (Claude Haiku, per-instance cap). "Flag for pattern review" button seeds pattern_candidates table.
- Week 8: Health history, multi-instance, RBAC enforcement

**Ship:** Teams self-serve with failure trends. Execs get a summary view with metrics that justify the tool.

### Phase 3: Alerts + SSO + First-Run (Weeks 9-11)
- Week 9: Alert rules engine + Slack/email notifications
- Week 10: OIDC/SSO (Azure AD), auto-provisioning
- Week 11: First-run empty state (no instances configured -> guided "add Jenkins" flow, 2 days of work). Polish. Second design partner onboarding.

**Ship:** Production-ready for Neteera + first external design partner. Third partner can self-onboard without hand-holding.

### Phase 4: Scale + Pattern Intelligence (Weeks 12-14)
- Week 12: Pattern contribution UI (review queue, dedup, dry-run against historical builds, activation toggle, audit log)
- Week 13: Helm chart, S3 log retention, performance tuning, admin dashboard
- Week 14: Third design partner, GA readiness assessment, API docs

---

## Team (5 people)

### 1. Product Designer (Day 1)

**Weeks 1-2 deliverables (must unblock frontend engineer by Week 3):**
- Mantine component library in Figma - documented usage patterns for the specific Mantine components TIG uses. Designed against POC screenshots and real Jenkins UI.
- Three core screen flows in high fidelity: (1) failed build detail view, (2) team dashboard, (3) instance health view. These are 80% of what the primary user sees.

**Week 3-4 deliverables:**
- Data contract document - designer's articulation of "this screen needs X, Y, Z fields." Backend hire reads this to know what the frontend consumes. Forces data thinking, not just pixels.

**Week 4 review gate (definition of done):** the frontend engineer and backend engineer can both open the Figma file and answer their own questions without asking the designer. If they can't, Weeks 1-4 design work failed regardless of polish.

**Weeks 5+:** iterate on real user feedback, design alerts UX, pattern contribution UI, executive summary view.

### 2. Full-Stack Engineer (Backend-leaning)
TIG API, DB, crawl pipeline, auth. Joins into a working skeleton (Week 0 output).

### 3. Full-Stack Engineer (Frontend-leaning)
Weeks 1-2: pairs with backend on API layer (builds API, jobs API) - they own the data contracts the frontend consumes. Week 3: scaffolds components from designer specs. Week 4+: owns the React migration and all frontend features.

This is a full-stack hire who skews frontend, not a frontend specialist. The Week 1-2 API pairing is legitimate work that makes them faster in Week 4, not filler.

### 4. DevOps/Platform Engineer
Docker, Helm, CI/CD for TIG itself, SSO integration. Co-owns design partner support with CTO - "customer's Jenkins is behind a proxy" is this person's problem.

### 5. You (CTO)
Week 0 scaffold. Product direction. Analysis engine. AI integration. First customer relationship. Co-owns design partner support.

---

## Success Criteria

### Infrastructure
- `docker compose up` in under 2 minutes
- Crawling under 10 req/s to Jenkins
- Credentials encrypted, never exposed to frontend
- 80%+ test coverage

### First-Run SLA
- Connect Jenkins instance and see first analyzed failures within 3-5 minutes
- Initial crawl completes without manual intervention

### Recurring Use SLA (the north star)
- Developer opens TIG after a failed build and gets actionable diagnosis in under 2 minutes
- Failed builds analyzed within 60 seconds of completion
- Less than 5% of failed builds classified as Unknown (with AI fallback)

### Product
- Team views via configurable folder patterns
- Health with 30s granularity
- Trends over 7/30/90 days (failure rate, MTTR, change failure rate)
- Executive summary view with DORA-adjacent metrics
- Local auth + Azure AD SSO

### Go-to-Market
- 3 design partners running in production before GA
- Zero hand-holding required for daily use after initial setup
