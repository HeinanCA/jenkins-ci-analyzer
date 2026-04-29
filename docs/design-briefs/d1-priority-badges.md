# D1 — Priority Badge System

**For:** Designer A
**Sprint deliverable:** D1 (Priority Tags)
**Engineering status:** Backend shipped to prod (commit `cab434f`). UI BLOCKED on this spec.
**Plan reference:** `/Users/heinan.c/.claude/plans/read-from-memories-synthetic-scone.md`

---

## What's needed

A 4-tier priority badge component for the Failures page. AI emits one priority per analyzed build; UI surfaces it on the failure card so devs scan-rank at a glance.

Priorities (highest → lowest weight):

| Value | Meaning | Example trigger |
|---|---|---|
| **BLOCKER** | Build infra broken; nobody can ship. | Compile fail, test runner crashed, deploy step failed. |
| **ACTIONABLE** | Real failure, clear fix path. | Test assertion, type error, missing config. |
| **FLAKY** | Intermittent / timing / network. | Cypress retry succeeded, sporadic timeout. |
| **INFRA** | Jenkins-side, not code. | Agent offline, queue stuck, executor dead. |
| **UNKNOWN** | Default; AI couldn't decide. | Hide or show very muted — your call. |

Weight order matters: cards sort BLOCKER → INFRA, UNKNOWN last.

---

## Where it lives

**Component:** `packages/frontend/src/features/failures/components/BrokenJobCard.tsx`
**Placement:** Inside `Accordion.Control`, top row of card, **before** the streak dots (currently line 81 area).
Existing structure:

```
[Job name] [streak dots + "3x"]
[AI summary one-liner]
```

After D1:

```
[PRIORITY BADGE] [Job name] [streak dots + "3x"]
[AI summary one-liner]
```

Inside the expanded `Accordion.Panel`, classification badge already exists ("Code" / "Infrastructure"). Decide whether priority badge appears there too or only collapsed view.

**Filter chip:** `packages/frontend/src/features/failures/FailuresPage.tsx` filter row (lines 238-295). Add a 5th filter (Team / Author / Code-Infra / Mine-Everyone / **Priority**). Filter chip should reuse same visual language as your badge (compact pill) so user understands the link.

---

## Context (not constraints)

This is design work, not paint-by-numbers. You own the visual system. The notes below are *context* — the history of how we got to the current theme — not rules to obey. If you propose a different direction with a clear rationale, that's the job.

**What happened before (so you don't have to learn it cold):**
- Engineering (without a designer) shipped an AI-SaaS-2024-style violet gradient theme. CEO called it derivative and we ripped it. The mistake was bad execution, not the color family. Violet/purple/pink are not banned — bad violet is.
- Current theme is intentionally Jenkins-bright dark (`#2B2B2B / #333` surfaces) + ember accent. It's deliberately not "modern AI app." That choice was reactive, not the final answer. Question it freely.
- We use Mantine; Tabler Icons are wired in. Emoji glyphs got removed because they read as 2010-era stylesheet markers. If you need icons, Tabler is set up.

**What you're free to do:**
- Propose a full theme refresh if priority badges expose a system that needs rethinking (typography, surface tone, accent strategy, dark-mode philosophy).
- Add new tokens. Engineering will wire them into `mantine-theme.ts`.
- Use any color family — including the ones we previously removed. CEO will react to the execution, not the swatch.
- Replace gradients with flat fills, or add gradients back where they earn their place.
- Push back on the badge-on-card approach if a better signal pattern exists (left-edge color bar? icon-only? full-row tint?).

**What we still won't do:**
- AA contrast minimum stands — accessibility is not aesthetic.
- Emoji glyphs as functional icons (Tabler is the system).
- Visual elements that imitate any specific competitor (Datadog, Sentry, LinearB, etc. — be derivative of nobody).

---

## Existing theme tokens (reference, not a wall)

Reuse if they fit. Replace if they don't. If you propose new tokens or a new palette, engineering wires it in.

From `packages/frontend/src/theme/mantine-theme.ts`:

```
bg              #2B2B2B    page background
surface         #333333    card background
surfaceLight    #1F1F1F    inset / code / pill bg candidate
border          #444444
borderHover     #555555

text            #FFFFFF
textSecondary   #CCCCCC
textTertiary    #999999
textMuted       #777777

success         #4ADE80    green
failure         #F87171    coral-red (already used for streak)
critical        #EF4444    pure red
warning         #FBBF24    amber
info            #60A5FA    blue
accent          #F56740    ember orange (signal — use sparingly)
```

Mantine colors available out-of-box: red, orange, yellow, green, blue, gray, etc. via `<Badge color="red">`.

---

## Per-priority signal direction

The semantic story matters more than the swatches:

- **BLOCKER** must read as "drop everything." Highest visual urgency in the entire UI.
- **ACTIONABLE** is the default working state — most failures land here. Should feel handle-able.
- **FLAKY** needs to communicate "not your fault, but worth a look." Distinct from BLOCKER.
- **INFRA** is "not the dev's problem." Visually deprioritized vs the others.
- **UNKNOWN** is the AI throwing up its hands. Hide, ghost, or surface as a "needs review" signal — your call.

Pulse animation exists on the header failure count badge (PulsCI brand cue). Whether BLOCKER inherits that, escalates it, or replaces it — open.

---

## Component contract (Mantine + Neteera conventions)

Engineering will implement these — your spec drives the props & states.

```tsx
// types/priority.ts ALREADY EXISTS in packages/shared
import type { FailurePriority } from '@tig/shared'

interface PriorityBadgeProps {
  priority: FailurePriority   // 'BLOCKER' | 'ACTIONABLE' | 'FLAKY' | 'INFRA' | 'UNKNOWN'
  size?: 'xs' | 'sm' | 'md'   // default 'sm' — match existing classification badge
  showLabel?: boolean         // default true; allow icon-only at xs
}
```

Will be implemented as:
- `packages/frontend/src/features/failures/components/PriorityBadge.tsx`
- `packages/frontend/src/features/failures/constants/priority-display.ts` — color map, icon map, label map (frontend-only display constants; backend-shared constants in `@tig/shared/constants/priority` already define order + label, do not duplicate).
- `packages/frontend/src/features/failures/hooks/usePriorityFilter.ts` — encapsulates filter state, useable by FailuresPage.

Engineering will NOT use inline styles. All visual properties go through Mantine theme overrides or `createStyles`.

---

## States required

For each of the 4 visible priorities (BLOCKER, ACTIONABLE, FLAKY, INFRA):

1. Default (collapsed card)
2. Hover (card hovered, badge inherits or reacts?)
3. Selected (when this priority is the active filter)
4. Active filter chip (in filter row, "Priority: BLOCKER" with X to clear)

Plus:
- UNKNOWN treatment (hide vs ghost)
- Empty state on FailuresPage filtered to a priority with zero matches (currently shows generic "No failures" — does priority filter need its own message?)
- Mobile / narrow viewport — does badge collapse to icon-only?

---

## Deliverables (what engineering needs from you)

1. **Figma frame** with all priorities × all states (default / hover / selected / filter-active), plus UNKNOWN treatment.
2. **Token sheet** — concrete hex values plus mappings to theme tokens (existing or new). Engineering wires new tokens into `mantine-theme.ts`.
3. **Iconography decision** — Tabler Icon names per priority, or explicit "no icon," or your alternative system.
4. **Sort + grouping behavior** — when filter is "All", group by priority or sort flat? Visual dividers between sections?
5. **Filter chip pattern** — your call (SegmentedControl, Chip group, Select, custom).
6. **Accessibility** — AA contrast confirmed on every color against the chosen surface; focus-ring spec included.
7. **Theme delta (if any)** — if priority badges expose that the broader theme needs to evolve, propose the delta. New surface tones, accent strategy, gradient policy — fair game.

---

## Designer-A handoff timing

- Engineering ready to implement immediately on spec landing.
- D2 (Flake detection) backend will run in parallel; Designer A's flake badge spec is also coming up — flake spec can build on whatever badge primitive D1 establishes (DRY).

---

## What hurts scan-ability (engineering observations, not design rules)

These come from watching the failures page in use. Override if you have a reason:

- Multi-color pill (e.g. red half / amber half) — eye doesn't land.
- Tooltip-only priority — must be visible in the row, not on hover.
- Identical color across two priorities differentiated only by shape — fails for color-blind users *and* under fast scan.

---

## Open questions to answer in the Figma

1. Show UNKNOWN or hide? (Recommendation: hide.)
2. Group failures by priority sections, or single sorted list?
3. Filter UI: SegmentedControl vs Chips vs Select?
4. Pulse on BLOCKER: yes / no / only when count > N?
5. Icon-only at narrow viewport — what's the breakpoint?

Drop answers + Figma link in #pulsci-design (or wherever team is collaborating). Engineering picks up immediately on spec landing.
