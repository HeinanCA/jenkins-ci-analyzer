# TIG Hiring — Week 0.5

Fully remote. Senior (5+ years). Three roles, hired in parallel.

---

## 1. Product Designer

**Title:** Senior Product Designer — Developer Tools

**What you'll do:**
- Own the entire design surface of PulsCI, a CI/CD diagnostics platform that translates build failures into plain English for R&D teams
- Week 1-2: deliver three core screen flows in high fidelity (failure analysis view, team dashboard, health status) plus a Mantine-based component library in Figma
- Week 3-4: deliver data contract documents that backend and frontend engineers use to build against — you think in data, not just pixels
- Week 5+: iterate on real user feedback from design partners, design alerts UX, pattern contribution flows, executive summary views

**Definition of done (Week 4 gate):** the frontend and backend engineers can open your Figma file and answer their own questions without asking you. If they can't, the work failed regardless of how polished it looks.

**Must have:**
- 5+ years of product design experience
- Portfolio showing developer tools, dashboards, or data-heavy applications
- Fluent in Figma with experience building component libraries against existing UI frameworks (Mantine, Chakra, MUI — not custom design systems from scratch)
- Comfortable articulating what data a screen needs, not just how it looks
- Experience working directly with engineers in a startup or small team setting

**Nice to have:**
- Experience with CI/CD tools (Jenkins, GitHub Actions, GitLab CI) as a user
- Designed for self-hosted or on-prem products
- Familiarity with DORA metrics or engineering productivity tooling

---

## 2. Full-Stack Engineer (Backend-Leaning)

**Title:** Senior Full-Stack Engineer — Backend

**What you'll do:**
- Own the TIG API (Fastify), database layer (Drizzle + PostgreSQL), Jenkins crawler, and analysis pipeline
- Week 1: credential vault service, CI instance CRUD endpoints, Jenkins API proxy
- Week 2: auth integration (better-auth), crawl scheduler (graphile-worker), job discovery with rate limiting (Bottleneck)
- Week 3: build sync worker, jobs/builds API, log proxy endpoint
- Week 4+: team CRUD, trends API, RBAC, multi-instance support

**You'll join into a working skeleton:** pnpm monorepo, Fastify returning a health check, Drizzle schema with 12 tables migrated, graphile-worker wired up, Docker Compose running Postgres + API + Worker. You ship on Day 1, not set up on Day 1.

**Must have:**
- 5+ years building backend services in Node.js / TypeScript
- Strong PostgreSQL experience (schema design, queries, migrations)
- Experience building REST APIs with input validation and proper error handling
- Understanding of auth flows (sessions, tokens, OIDC concepts)
- Comfortable with background job processing (any queue system)

**Nice to have:**
- Experience with Fastify (vs Express)
- Experience with Drizzle ORM
- Experience integrating with Jenkins or other CI/CD APIs
- Built self-hosted / on-prem software before
- Experience with rate limiting and API proxying

**Tech stack:** TypeScript, Fastify, Drizzle ORM, PostgreSQL, graphile-worker, better-auth, Bottleneck, Zod

---

## 3. Full-Stack Engineer (Frontend-Leaning)

**Title:** Senior Full-Stack Engineer — Frontend

**What you'll do:**
- Own the React SPA: migrate from POC to production, implement the designer's specs, build data visualization and trend charts
- Week 1-2: pair with backend engineer on API layer (builds API, jobs API) — you own the data contracts the frontend consumes
- Week 3: scaffold components from designer's Figma specs using Mantine
- Week 4: migrate the SPA to talk to TIG API instead of Jenkins directly, implement auth flow, remove the dev proxy
- Week 5+: team management UI, trend charts (Recharts), executive summary view, alert configuration, pattern contribution UI

**Must have:**
- 5+ years building web applications in React + TypeScript
- Experience with a component library (Mantine, Chakra, MUI)
- Experience with data fetching libraries (TanStack Query / React Query)
- Experience with data visualization (Recharts, D3, Chart.js)
- Comfortable writing API integration code and working with backend engineers on contract design
- Can translate a Figma design into production components without pixel-by-pixel handholding

**Nice to have:**
- Experience with Mantine specifically
- Experience with Zustand for state management
- Built dashboards or monitoring UIs
- Experience with CI/CD tools as a user
- Worked in a startup or small team where you own the full frontend

**Tech stack:** TypeScript, React, Mantine v8, TanStack Query, Zustand, Recharts, Zod, Vite

---

## What all three roles share

**About the product:** PulsCI is a self-hosted CI/CD diagnostics platform. When a developer's build fails, they open PulsCI and get a plain-English explanation of what broke, whether it's their code or infrastructure, and what to do about it — in under 2 minutes, without pinging DevOps. We start with Jenkins, expand to GitHub Actions and GitLab CI.

**About the team:** You're joining a 5-person team inside Neteera building an internal product with external ambitions. The CEO is a former DevOps engineer who lived this problem. The CTO built the working POC. You'll ship to real users (Neteera's R&D team) within weeks, not months.

**How we work:**
- Fully remote, async-friendly
- Small team, high ownership — you own your domain end-to-end
- Ship weekly. Every phase has a concrete deliverable with a hard definition of done.
- The codebase is TypeScript everywhere — shared analysis engine, Fastify backend, React frontend. One language, three packages.
- We use Docker Compose for local dev and deployment. `docker compose up` and you're running.

**What we offer:**
- Early-stage startup equity in TIG alongside competitive salary
- Direct impact: your code ships to users immediately
- Full ownership of your domain — no ticket jockeys, no JIRA boards, no standups longer than 10 minutes
