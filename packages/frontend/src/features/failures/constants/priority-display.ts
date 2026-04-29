import { type ComponentType } from 'react';
import {
  IconAlertOctagon,
  IconCircleCheck,
  IconCloudQuestion,
  IconServer,
} from '@tabler/icons-react';
import type { FailurePriority } from '@tig/shared';
import { colors } from '../../../theme/mantine-theme';

// ─── Priority display constants ───────────────────────────────
// All color values reference theme tokens — no inline hex literals.
// UNKNOWN is included so lookups never return undefined; it renders null in PriorityBadge.

export interface PriorityDisplayConfig {
  readonly label: string;
  readonly bg: string;
  readonly fg: string;
  readonly border: string;
  readonly icon: ComponentType<{ size?: number; stroke?: number }> | null;
}

export const PRIORITY_DISPLAY: Record<FailurePriority, PriorityDisplayConfig> = {
  BLOCKER: {
    label: 'Blocker',
    bg: colors.priorityBlocker,
    fg: colors.priorityBlockerFg,
    border: colors.priorityBlockerBorder,
    icon: IconAlertOctagon,
  },
  ACTIONABLE: {
    label: 'Actionable',
    bg: colors.priorityActionable,
    fg: colors.priorityActionableFg,
    border: colors.priorityActionableBorder,
    icon: IconCircleCheck,
  },
  FLAKY: {
    label: 'Flaky',
    bg: colors.priorityFlaky,
    fg: colors.priorityFlakyFg,
    border: colors.priorityFlakyBorder,
    icon: IconCloudQuestion,
  },
  INFRA: {
    label: 'Infra',
    bg: colors.priorityInfra,
    fg: colors.priorityInfraFg,
    border: colors.priorityInfraBorder,
    icon: IconServer,
  },
  UNKNOWN: {
    label: 'Unknown',
    bg: 'transparent',
    fg: colors.textMuted,
    border: colors.border,
    icon: null,
  },
} as const;
