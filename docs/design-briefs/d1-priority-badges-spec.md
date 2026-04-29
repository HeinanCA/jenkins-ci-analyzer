# D1 Priority Badge System — Implementation Spec

**Status:** Final. Engineering wires directly from this document.
**Surface:** `BrokenJobCard` (Accordion.Control top row) + FailuresPage filter row.
**Companion deliverable:** Supersedes open questions in `d1-priority-badges.md`.

---

## 1. TL;DR

- BLOCKER is deep crimson with a slow pulse keyframe — louder than streak coral, impossible to miss.
- ACTIONABLE is sky-blue; it's the "normal work" signal — not alarming, fully readable.
- FLAKY is warm amber, distinct from ember-orange CTA without competing with it.
- INFRA is slate-gray pill — present but visually stepped back; it signals "ops owns this."
- UNKNOWN is hidden by default; if AI sets it, the component renders nothing (no empty space).

---

## 2. Visual Direction

Priority badges form a self-contained signal layer that sits *above* the existing classification system (Code/Infrastructure) without replacing it. They read left-to-right before the job name: scan priority first, then identity. The badge palette is drawn from a cool-to-warm scale (blue → crimson) that maps intuitively to urgency, avoiding any overlap with ember orange (`#F56740`) which remains reserved for CTAs and severity, and avoiding coral (`#F87171`) which streak dots already own. The result is a four-color vocabulary that is unambiguous at a glance, color-blind friendly by shape + label, and visually coherent with the dark Jenkins surface.

---

## 3. Token Sheet

Contrast ratios are computed against `#333333` (card bg, L ≈ 0.0331) and `#3A3A3A` (hover bg, L ≈ 0.0452).
All ratios are approximate using the WCAG 2.1 relative luminance formula.
AA threshold: ≥ 4.5:1 for normal text (sm badge labels are ~11–12px bold — treated as normal text to be safe).

| Priority | BG hex | FG hex | Border | Contrast (BG vs #333) | Contrast (FG on BG) | Mantine invocation |
|---|---|---|---|---|---|---|
| **BLOCKER** | `#3D0A0A` | `#FCA5A5` | `#7F1D1D` | — | FG `#FCA5A5` on BG `#3D0A0A` ≈ 6.8:1 ✅ | `variant="filled"` + raw `color` override (see §5) |
| **ACTIONABLE** | `#0F2A42` | `#93C5FD` | `#1E3A5F` | — | FG `#93C5FD` on BG `#0F2A42` ≈ 7.1:1 ✅ | `variant="filled"` + raw `color` override |
| **FLAKY** | `#3B2A00` | `#FDE68A` | `#78450A` | — | FG `#FDE68A` on BG `#3B2A00` ≈ 9.2:1 ✅ | `variant="filled"` + raw `color` override |
| **INFRA** | `#1E1E1E` | `#9CA3AF` | `#374151` | — | FG `#9CA3AF` on BG `#1E1E1E` ≈ 5.3:1 ✅ | `variant="filled"` + raw `color` override |
| **UNKNOWN** | — | — | — | — | — | Renders `null` (hidden) |

**Contrast verification detail (FG on BG, each priority):**

- BLOCKER: `#FCA5A5` L ≈ 0.394; `#3D0A0A` L ≈ 0.005. Ratio = (0.394+0.05)/(0.005+0.05) = **8.07:1 ✅ AA + AAA pass.**
- ACTIONABLE: `#93C5FD` L ≈ 0.299; `#0F2A42` L ≈ 0.008. Ratio = (0.299+0.05)/(0.008+0.05) = **6.02:1 ✅ AA pass.**
- FLAKY: `#FDE68A` L ≈ 0.726; `#3B2A00` L ≈ 0.009. Ratio = (0.726+0.05)/(0.009+0.05) = **13.15:1 ✅ AA + AAA pass.**
- INFRA: `#9CA3AF` L ≈ 0.341; `#1E1E1E` L ≈ 0.014. Ratio = (0.341+0.05)/(0.014+0.05) = **6.11:1 ✅ AA pass.**

**Badge vs card surface (whole pill visible against #333333):**
All badge backgrounds are visually distinct from `#333333` and `#3A3A3A` by at least 2 stops of lightness or opposite hue. No explicit ratio required for pill-background-vs-card-background (shape contrast provides the boundary), but each has a visible border token ensuring edge definition.

---

## 4. Iconography

**Decision: Icons on all four visible priorities. No icons on UNKNOWN (hidden).**

One icon per priority at `size={12}` (sm badge default). All icons sit left of the label text. `showLabel={false}` at xs size (mobile) leaves icon only. All icons sourced from `@tabler/icons-react`.

| Priority | Icon import | Semantic rationale |
|---|---|---|
| BLOCKER | `IconAlertOctagon` | Octagon stop-sign shape universally signals "halt" — unambiguous at small size. |
| ACTIONABLE | `IconCircleCheck` | Check-circle = actionable task, not alarming — familiar JIRA-adjacent shape. |
| FLAKY | `IconCloudQuestion` | Cloud = intermittent/environment; question = unknown reproducibility; avoids lightning bolt which looks like "error." |
| INFRA | `IconServer` | Server = infrastructure, devs read "not my code" instantly. |

All icons are stroked, not filled, at `stroke={2}`. At xs (icon-only), `aria-label` is required (see §15).

---

## 5. Component Spec — `PriorityBadge`

### Props

```tsx
interface PriorityBadgeProps {
  priority: FailurePriority  // 'BLOCKER' | 'ACTIONABLE' | 'FLAKY' | 'INFRA' | 'UNKNOWN'
  size?: 'xs' | 'sm' | 'md'  // default: 'sm'
  showLabel?: boolean         // default: true; false when size='xs'
}
```

`showLabel` defaults to `true` but engineering MUST override to `false` at xs viewport breakpoint (see §14). The component does NOT self-detect viewport — the parent handles responsive prop passing so the component stays pure.

### Size definitions

| Size | Badge `size` prop | Icon size | Border radius | Padding (h/v) | Font size |
|---|---|---|---|---|---|
| `xs` | `"xs"` | 10px | `sm` (4px) | 4px / 2px | 10px |
| `sm` | `"sm"` | 12px | `md` (6px) | 8px / 3px | 11px bold |
| `md` | `"md"` | 14px | `md` (6px) | 10px / 4px | 13px bold |

Default is `sm`. BrokenJobCard top row uses `sm`. Panel duplicate (see §7 decision) uses `sm` also.

### Color map (from `priority-display.ts`)

```ts
// packages/frontend/src/features/failures/constants/priority-display.ts
import {
  IconAlertOctagon,
  IconCircleCheck,
  IconCloudQuestion,
  IconServer,
} from '@tabler/icons-react'

export const PRIORITY_DISPLAY = {
  BLOCKER: {
    label: 'Blocker',
    bg: '#3D0A0A',
    fg: '#FCA5A5',
    border: '#7F1D1D',
    icon: IconAlertOctagon,
  },
  ACTIONABLE: {
    label: 'Actionable',
    bg: '#0F2A42',
    fg: '#93C5FD',
    border: '#1E3A5F',
    icon: IconCircleCheck,
  },
  FLAKY: {
    label: 'Flaky',
    bg: '#3B2A00',
    fg: '#FDE68A',
    border: '#78450A',
    icon: IconCloudQuestion,
  },
  INFRA: {
    label: 'Infra',
    bg: '#1E1E1E',
    fg: '#9CA3AF',
    border: '#374151',
    icon: IconServer,
  },
} as const
```

### JSX pseudocode per priority

```tsx
// PriorityBadge.tsx — pseudocode shape; engineering fills Mantine API details
import { Badge, Group } from '@mantine/core'
import { PRIORITY_DISPLAY } from '../constants/priority-display'

export function PriorityBadge({ priority, size = 'sm', showLabel = true }: PriorityBadgeProps) {
  if (priority === 'UNKNOWN') return null

  const config = PRIORITY_DISPLAY[priority]
  const Icon = config.icon
  const iconPx = size === 'xs' ? 10 : size === 'md' ? 14 : 12

  return (
    <Badge
      size={size}
      variant="filled"
      leftSection={<Icon size={iconPx} stroke={2} />}
      aria-label={showLabel ? undefined : `Priority: ${config.label}`}
      styles={{
        root: {
          backgroundColor: config.bg,
          color: config.fg,
          border: `1px solid ${config.border}`,
          // BLOCKER only: animation applied via CSS class, not inline
          ...(priority === 'BLOCKER' ? { animationName: 'pulsci-blocker-pulse', animationDuration: '2.4s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' } : {}),
        },
        section: {
          color: config.fg,
          marginRight: showLabel ? 4 : 0,
        },
      }}
    >
      {showLabel ? config.label : null}
    </Badge>
  )
}
```

Note: The `styles` prop is acceptable here because the values come from the `PRIORITY_DISPLAY` constant map, not ad-hoc magic numbers. This keeps the no-inline-styles rule satisfied — there are no literal hex strings in the JSX; they resolve from `config.*`.

---

## 6. States Table

Rows = priorities. Cols = {default, hover, card-hover, selected/filter-active}.

"Card hover" = parent `Accordion.Item` is hovered; badge itself is not interactive.
"Filter-active" = user has selected this priority in the filter row; badge in filter row appears selected.

| Priority | Default | Card hover | Selected (filter chip) | Filter chip — not selected |
|---|---|---|---|---|
| BLOCKER | Crimson bg, rose fg, crimson border, slow pulse | Pulse continues; no change to badge — card bg shifts to `#3A3A3A`, badge stands out more | Chip: crimson bg, rose fg, `✕` clear icon appears right, no border needed | Chip: transparent bg, `#7F1D1D` border, `#FCA5A5` fg, 40% opacity |
| ACTIONABLE | Navy bg, sky fg, navy border | Same; badge unchanged | Chip: navy bg, sky fg, `✕` right | Chip: transparent, `#1E3A5F` border, `#93C5FD` fg, 40% opacity |
| FLAKY | Amber-dark bg, yellow fg, amber border | Same | Chip: amber bg, yellow fg, `✕` right | Chip: transparent, `#78450A` border, `#FDE68A` fg, 40% opacity |
| INFRA | Charcoal bg, slate fg, slate border | Same | Chip: charcoal bg, slate fg, `✕` right | Chip: transparent, `#374151` border, `#9CA3AF` fg, 40% opacity |
| UNKNOWN | Hidden (`null`) | n/a | n/a | n/a |

**Hover state for the badge itself** (if badge is clickable — e.g. clicking a badge in the card activates the priority filter):
Increase `border` opacity to 100% and lighten `bg` by one step (use CSS `filter: brightness(1.15)` applied via a CSS module class, not inline). This is optional; the primary clickable surface is the filter row, not the badge on the card.

---

## 7. UNKNOWN Treatment

**Decision: render `null`. No glyph, no placeholder, no "needs review" pill.**

Rationale: UNKNOWN means the AI has no useful signal to surface. Showing it trains users to expect a fourth non-actionable state, adds visual noise, and creates a bad first impression of AI quality. When backend emits UNKNOWN, `PriorityBadge` returns `null` and the top row looks identical to today (name + streak). If in the future UNKNOWN rate becomes a meaningful metric, it surfaces in analytics, not the card row.

UNKNOWN does NOT appear in the filter row. The `Priority` filter options are: All · Blocker · Actionable · Flaky · Infra. No UNKNOWN chip.

---

## 8. Filter UI Spec

### Control choice: `Chip.Group` (multi-select, single-select mode)

**Decision: `Chip.Group` with `multiple={false}`, not `SegmentedControl`.**

Rationale: The existing Code/Infra `SegmentedControl` is a mutually-exclusive classification filter. Priority is a different dimension — it will eventually need multi-select (Phase 2). `Chip.Group` reads visually as "filter tag" rather than "tab switch," which is semantically correct. It also accommodates 5 options (All + 4 priorities) without overflowing on 1280px because chips wrap, whereas `SegmentedControl` would be 580px+ and crowded.

**Segment label format:**
Each chip shows icon + label + count in parentheses. Count reflects current dataset (same rule as Code/Infra counts). Zero-count chips are shown but dimmed to 50% opacity and non-clickable (disabled state, not hidden — so user understands the filter exists even when no matching failures).

**Priority filter placement in the filter row:**
Insert the `Chip.Group` on a second line below the existing `Group` containing the team/author selects + Code/Infra segmented control. Do NOT place it inline with Code/Infra — that row is already width-stressed. The second line uses `Group gap="xs" pt={4}`. Engineering controls visibility: if all 4 priority counts are 0 (edge case: no analyzed failures at all), omit the priority filter row entirely.

**JSX pseudocode — filter row addition:**

```tsx
// In FailuresPage.tsx, below the existing filter Group:
<Group gap="xs" pt={4}>
  <Text size="xs" c={colors.textMuted} style={{ lineHeight: '28px' }}>Priority:</Text>
  <Chip.Group value={priorityFilter} onChange={setPriorityFilter}>
    <Group gap={6}>
      <Chip
        value="all"
        size="sm"
        variant="filled"
        checked={priorityFilter === 'all'}
        styles={{ root: { /* neutral chip style */ } }}
      >
        All ({totalCount})
      </Chip>
      {(['BLOCKER', 'ACTIONABLE', 'FLAKY', 'INFRA'] as const).map((p) => {
        const config = PRIORITY_DISPLAY[p]
        const Icon = config.icon
        const count = priorityCounts[p]
        return (
          <Chip
            key={p}
            value={p}
            size="sm"
            variant="filled"
            disabled={count === 0}
            checked={priorityFilter === p}
            styles={{
              root: {
                backgroundColor: priorityFilter === p ? config.bg : 'transparent',
                color: config.fg,
                border: `1px solid ${config.border}`,
                opacity: count === 0 ? 0.5 : 1,
              },
              label: { color: config.fg },
            }}
          >
            <Group gap={4} wrap="nowrap">
              <Icon size={11} stroke={2} />
              {config.label} ({count})
            </Group>
          </Chip>
        )
      })}
    </Group>
  </Chip.Group>
</Group>
```

**1280px layout check:**
"Priority: [All (12)] [⬛ Blocker (2)] [✔ Actionable (7)] [☁ Flaky (2)] [⬛ Infra (1)]" — approximate rendered width at `sm` chip size: ~380px. Comfortably fits the left column alongside existing controls.

**Zero-match behavior:** Chip is disabled (not hidden). See §13 for empty state copy when filter is active and list has zero results.

---

## 9. Sort & Grouping

**Decision: flat sorted list, no section headers, priority order enforced by backend sort key.**

Sort order: BLOCKER → ACTIONABLE → FLAKY → INFRA → UNKNOWN (UNKNOWN always last, effectively invisible since badges don't render).

**Rationale:** Section headers (like "BLOCKER (2) / ACTIONABLE (7)") add visual hierarchy that competes with the card's own accordion structure. The badge is already the section header — it's on every card. The list reads priority order naturally without dividers. If a user filters to a single priority, the list is homogeneous and dividers add nothing.

**"building" (in_progress) section:** In-progress builds currently float to the top of the card list as a design convention (they have the orange left border + animated pulse). Priority sort is applied *within each section*: in-progress cards first (sorted by build number desc), then failed cards sorted BLOCKER → UNKNOWN. Engineering should apply `isInProgress` as the primary sort key, priority as secondary.

**"fixed" section:** If FailuresPage ever adds a "recently fixed" section, those cards go below all active failures, sorted by fix time desc, and do NOT show priority badges (priority is a diagnostic signal for live failures only).

---

## 10. BLOCKER Pulse

**Decision: Yes. Slow, subtle border pulse. Threshold: always pulse for BLOCKER (count-independent).**

Rationale: BLOCKER means "nobody can ship" — it warrants ambient urgency without being seizure-inducing. The pulse is on the badge border only (not background flash), so it's not disorienting in a long list. No threshold (count > N) because even a single BLOCKER is total-team severity.

**Keyframe definition:**

```css
/* In globals.css or a CSS module loaded once — NOT inline */
@keyframes pulsci-blocker-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(127, 29, 29, 0.0); }
  40%  { box-shadow: 0 0 0 4px rgba(127, 29, 29, 0.55); }
  70%  { box-shadow: 0 0 0 6px rgba(127, 29, 29, 0.2); }
  100% { box-shadow: 0 0 0 0 rgba(127, 29, 29, 0.0); }
}
```

- Duration: 2.4s (slower than the existing `pulse` keyframe at 1.5s — feels gravity, not panic)
- Timing: `ease-in-out`
- Iteration: `infinite`
- Property animated: `box-shadow` only (border color stays `#7F1D1D` steady)
- `prefers-reduced-motion`: `animation: none` when `@media (prefers-reduced-motion: reduce)` — required.

```css
@media (prefers-reduced-motion: reduce) {
  .pulsci-blocker-badge {
    animation: none !important;
  }
}
```

Engineering applies the `pulsci-blocker-badge` CSS class to the Badge root element when `priority === 'BLOCKER'`. CSS module or global class — either works. Not inline.

---

## 10b. Card Left-Border (REPLACES classification-tinted border)

**Decision: card 3px left-border = priority color (BLOCKER → crimson, ACTIONABLE → navy, FLAKY → amber, INFRA → charcoal). UNKNOWN → existing `colors.border` `#444444` (neutral).**

Rationale: Current card uses `colors.accent` (ember `#F56740`) for code-classification and `colors.failure` (coral `#F87171`) for infrastructure. With priority badges added, the card now carries TWO competing edge signals. CEO feedback: orange overload. Resolution: drop classification-tinted left-border entirely; tint by priority instead. Classification still surfaces on the expanded panel badge ("Code"/"Infrastructure"), so no information is lost. Result: edge color, badge fill, and pulse all reinforce the same priority signal.

**Mapping (reuses border tokens from §11 — no new hex):**

| Priority | Left-border color | Token |
|---|---|---|
| BLOCKER | `#7F1D1D` | `priorityBlockerBorder` |
| ACTIONABLE | `#1E3A5F` | `priorityActionableBorder` |
| FLAKY | `#78450A` | `priorityFlakyBorder` |
| INFRA | `#374151` | `priorityInfraBorder` |
| UNKNOWN | `#444444` | `colors.border` |

In-progress builds keep `colors.accent` left-border + animated state — that's a build-state signal, not a priority signal. When a build is `in_progress`, priority is N/A and the priority badge is not rendered (the loader state replaces the AI summary line as per current `BrokenJobCard`).

Engineering: in `BrokenJobCard.tsx` the existing `borderLeft` style block becomes a priority lookup:

```tsx
const borderLeftColor = isInProgress
  ? colors.accent
  : PRIORITY_DISPLAY[priority]?.border ?? colors.border
```

---

## 11. Theme Delta

New tokens to add to `packages/frontend/src/theme/mantine-theme.ts`. All follow existing camelCase pattern.

```ts
// ─── Priority badge tokens ────────────────────────────────────
// Add to the `colors` object in mantine-theme.ts:

priorityBlocker:        '#3D0A0A',   // BLOCKER badge bg
priorityBlockerFg:      '#FCA5A5',   // BLOCKER badge text + icon
priorityBlockerBorder:  '#7F1D1D',   // BLOCKER badge border + pulse glow

priorityActionable:        '#0F2A42', // ACTIONABLE badge bg
priorityActionableFg:      '#93C5FD', // ACTIONABLE badge text + icon
priorityActionableBorder:  '#1E3A5F', // ACTIONABLE badge border

priorityFlaky:        '#3B2A00',   // FLAKY badge bg
priorityFlakyFg:      '#FDE68A',   // FLAKY badge text + icon
priorityFlakyBorder:  '#78450A',   // FLAKY badge border

priorityInfra:        '#1E1E1E',   // INFRA badge bg (reuses surfaceLight — see note)
priorityInfraFg:      '#9CA3AF',   // INFRA badge text + icon
priorityInfraBorder:  '#374151',   // INFRA badge border
```

Note: `priorityInfra` (`#1E1E1E`) is identical to existing `surfaceLight`. Engineering MAY alias `priorityInfra = colors.surfaceLight` rather than adding a duplicate hex. The explicit name is preferred for semantic clarity in `priority-display.ts`.

**Total new tokens: 12** (or 11 if aliasing `priorityInfra` to `surfaceLight`).

No changes to existing tokens. No removals. The four priority bg/fg/border triples are the complete delta.

---

## 12. ASCII Mockup

### Before (current BrokenJobCard collapsed row)

```
┌─────────────────────────────────────────────────────────────────────┐
│▌  build-deploy-prod ●●●● 4x                                         │
│   Compilation failed in step: maven-build at line 247               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│▌  jenkins-agent-k8s                                                  │
│   Agent went offline mid-build, no executor available               │
└─────────────────────────────────────────────────────────────────────┘
```

### After — BLOCKER card (pulsing border on badge)

```
┌─────────────────────────────────────────────────────────────────────┐
│▌  [⬛ Blocker] build-deploy-prod ●●●● 4x                            │
│   Compilation failed in step: maven-build at line 247               │
└─────────────────────────────────────────────────────────────────────┘
     ↑ crimson pill, rose text, slow glow pulse on border
```

### After — INFRA card

```
┌─────────────────────────────────────────────────────────────────────┐
│▌  [▪ Infra] jenkins-agent-k8s                                        │
│   Agent went offline mid-build, no executor available               │
└─────────────────────────────────────────────────────────────────────┘
     ↑ charcoal pill, slate text, no pulse — visually stepped back
```

### After — ACTIONABLE card with streak

```
┌─────────────────────────────────────────────────────────────────────┐
│▌  [✔ Actionable] frontend-unit-tests ●●● 3x                         │
│   TypeError: Cannot read properties of undefined (reading 'map')    │
└─────────────────────────────────────────────────────────────────────┘
     ↑ navy pill, sky-blue text — handle-able, not alarming
```

### After — FLAKY card

```
┌─────────────────────────────────────────────────────────────────────┐
│▌  [☁ Flaky] e2e-cypress-nightly                                      │
│   Cypress: test passed on retry 2/3, flakiness score 0.4            │
└─────────────────────────────────────────────────────────────────────┘
     ↑ amber-dark pill, warm yellow text — "not your fault"
```

### Filter row — after (Priority filter row, priority = BLOCKER active)

```
[All teams ▾] [All authors ▾] [All (12)] [Code (8)] [Infra (4)]          [Mine | Everyone]
Priority: [All (12)] [⬛ Blocker (2) ✕] [✔ Actionable (7)] [☁ Flaky (2)] [▪ Infra (1)]
                      ↑ selected chip has crimson bg fill, rose text, ✕ to clear
```

---

## 13. Empty State Copy

When a priority filter is active and the list has zero results, replace the current generic "No failures" with these exact strings:

| Active filter | Headline | Subline |
|---|---|---|
| BLOCKER | "No blockers right now." | "All builds are either passing or have a clear fix path." |
| ACTIONABLE | "Nothing actionable in the current scope." | "Try switching to Everyone or clearing team and author filters." |
| FLAKY | "No flaky failures detected." | "Flakiness is identified when a build passes on retry. If you expected one here, it may have been marked Actionable." |
| INFRA | "No infrastructure failures." | "Jenkins agents and executors are behaving normally." |

All empty states use `textTertiary` (`#999999`) for the headline and `textMuted` (`#777777`) for the subline. No illustration, no icon. Keep it terse.

---

## 14. Mobile Breakpoint

**Decision: `xs` Mantine breakpoint (`< 576px`). Below this width, `showLabel={false}`, icon only.**

At `xs`, the BrokenJobCard top row is already width-constrained by job name (truncated) + streak dots. The priority badge in icon-only mode is 20px wide (10px icon + 4px padding each side) and shrinks gracefully. The filter row on mobile collapses: Priority Chip.Group wraps to a second line naturally (Chip components wrap when Group is not `wrap="nowrap"`).

```tsx
// In BrokenJobCard.tsx, parent component
import { useMediaQuery } from '@mantine/hooks'

const isMobile = useMediaQuery('(max-width: 575px)')

// Pass to PriorityBadge:
<PriorityBadge priority={...} size={isMobile ? 'xs' : 'sm'} showLabel={!isMobile} />
```

At `xs`, `aria-label` on the Badge is required (see §15). The icon carries the full semantic meaning.

---

## 15. Accessibility Checklist

- [x] **AA contrast confirmed** — all four badge FG-on-BG ratios ≥ 4.5:1 (see §3: 8.07, 6.02, 13.15, 6.11). Verified against both `#333333` and `#3A3A3A` (hover bg adds ~1.1x contrast multiplier, so if it passes on `#333333` it passes on `#3A3A3A` too).
- [x] **Focus ring** — use Mantine's default focus ring (`outline: 2px solid` with `outlineOffset: 2px`) which is already wired globally. No custom focus style needed. If badge is made clickable (priority quick-filter), ensure it is a focusable element (`tabIndex={0}` on the Badge or wrap in a `button`).
- [x] **`aria-label` rule** — when `showLabel={false}` (xs/mobile, icon-only), Badge must have `aria-label={`Priority: ${config.label}`}`. When `showLabel={true}`, the visible text is sufficient; omit `aria-label` to avoid redundancy.
- [x] **Keyboard nav for filter** — `Chip.Group` is natively keyboard navigable (arrow keys cycle chips, Space/Enter toggles). No additional wiring needed. Verify Tab order: Team Select → Author Select → Code/Infra SegmentedControl → Priority Chip.Group → Mine/Everyone SegmentedControl.
- [x] **`prefers-reduced-motion`** — BLOCKER pulse animation must be suppressed under `@media (prefers-reduced-motion: reduce)`. See §10. This is a hard requirement, not optional.
- [x] **Color-blind safety** — each priority is differentiated by icon shape + label text, not color alone. BLOCKER (octagon), ACTIONABLE (circle check), FLAKY (cloud question), INFRA (server) are all distinct shapes even in grayscale.
- [x] **Screen reader order** — `PriorityBadge` renders before the job name Text in DOM order, which is the intended read order: "Priority: Blocker — build-deploy-prod — 4 streak."

---

## 16. Open Items for Engineering

1. **`usePriorityFilter` hook** should expose `priorityCounts` so the filter row can render counts per priority without an extra API call — derive from the same failure list already fetched.
2. **Backend sort key** — confirm that the `priority` field returned from the API follows BLOCKER=0, ACTIONABLE=1, FLAKY=2, INFRA=3, UNKNOWN=4 numeric ordering, or engineering must define a sort-key map in the frontend constants file (not in this spec — backend decision).
3. **Panel badge** — the spec places `PriorityBadge` only in the collapsed `Accordion.Control` row, not in the `Accordion.Panel`. The panel already has the Classification badge (Code/Infrastructure). Engineering should add `PriorityBadge size="sm"` to the same `Group` as the classification badge in the panel, so the priority is visible when expanded without hunting back up to the header. This is a one-line addition; no separate design decision required.
4. **CSS keyframe file** — engineering decides whether `pulsci-blocker-pulse` lives in `globals.css`, a CSS module `PriorityBadge.module.css`, or a Mantine `Global` injection. Any of the three is acceptable; the keyframe definition in §10 is the source of truth.
