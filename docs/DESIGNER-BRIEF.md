# PulsCI Designer Brief

## Context

PulsCI is a CI/CD diagnostics tool. When a developer's build fails, they open PulsCI and get an AI-powered explanation of what broke, why, and what to do. Target users: R&D developers who don't understand Jenkins.

The product works. The UI doesn't match the product quality.

## Current State

5 pages: Login, Dashboard, Failures, Health, Teams. All built by engineers using Mantine v8 dark theme with inline styles. No design system, no visual identity beyond "dark background + cards."

## What's Wrong (from engineer + CEO feedback)

### Identity
- No visual language that says "CI/CD tool." Could be any SaaS dashboard.
- The login page (gradient bg, terminal animation) has personality. The app pages don't.
- "PulsCI by That Infrastructure Guy" in the header — needs a logo or at least consistent brand treatment.

### Consistency
- Colors are hardcoded hex values scattered across components (#e2e8f0, #1e2030, #475569, #64748b, #94a3b8, #34d399, #f87171, #60a5fa)
- Card style is repeated as inline `{ backgroundColor: '#1e2030', border: 'none' }` in every file
- No Mantine theme customization — should move palette into theme
- Text hierarchy is inconsistent (some use Mantine color props, some use inline hex)

### Layout
- Sidebar is plain text links — functional but no character
- Header is cramped: logo + brand text + AI cost + user name + sign out all in one row
- Cards are all the same size/weight regardless of importance

### Specific Pages

**Dashboard:**
- Health banner is just a dot + text. Needs more visual weight as the first thing users see.
- Stats cards (Pipelines/Passing/Failing/Building) are uniform — Failing should stand out.
- Recent failures list has no visual hierarchy between items.

**Failures (most important page):**
- Accordion is functional but generic. Every AI chatbot uses accordions.
- When expanded: root cause, test name, file path, assertion, fix command, log insight, Jenkins link — all dumped in a flat Stack with no hierarchy.
- Root cause should be the most prominent element. Fix command should be visually distinct (copy-pasteable).
- The "💡 59% of this log is noise" insight needs a proper design treatment.
- Team selector + classification filter + title are crowded in one row.

**Health:**
- Score display is just a number. Could be a gauge, a ring, or something that conveys health at a glance.
- History is a list of badges + timestamps. Should be a sparkline or simple chart.
- Agent/executor cards are uniform — stuck agents should scream red.

**Teams (new):**
- Currently uses TagsInput for folder patterns — needs to change to a tree/checkbox picker (engineering will provide the data).
- Team cards are plain. Should show team health summary (e.g., "3 failing builds").

**Login:**
- Actually good. The terminal animation, the gradient, the brand presentation works. The app should inherit this energy without copying the layout.

## Deliverables

### Phase 1 (immediate — 3-5 days)
1. **Color palette + Mantine theme config** — define the palette once, apply everywhere. Primary, success, failure, warning, info, surface, border colors.
2. **Component patterns** — standard card, stat card, alert/banner, failure item, code block. Documented in Figma.
3. **Failures page redesign** — this is the core page. The expanded failure view needs clear hierarchy: summary → root cause → details → fix → insight → Jenkins link.

### Phase 2 (1 week)
4. **Dashboard layout** — health banner prominence, failure cards with AI summary preview.
5. **Health page** — score visualization, history chart, agent status grid.
6. **Teams page** — tree/checkbox folder picker, team health summary.

### Phase 3 (ongoing)
7. **Logo / brand mark** — something for the header and favicon.
8. **Empty states** — every page needs a good empty state, not just "No data."
9. **Loading states** — skeleton loaders instead of centered spinners.
10. **Mobile responsiveness** — sidebar should collapse.

## Technical Constraints
- Mantine v8 component library — design within its capabilities, don't fight it.
- Dark theme only (for now).
- Monospace for code/commands, system font for everything else.
- The AI-generated content (summary, root cause, fixes) varies in length — design must handle short and long text.

## Assets
- Current app: http://localhost:8090 (requires login)
- Screenshots: [engineer to provide]
- Codebase: packages/frontend/src/features/ — each page is a single file
