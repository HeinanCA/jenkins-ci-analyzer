import { Badge } from '@mantine/core';
import type { FailurePriority } from '@tig/shared';
import { PRIORITY_DISPLAY } from '../constants/priority-display';
import styles from './PriorityBadge.module.css';

// ─── Props ────────────────────────────────────────────────────
interface PriorityBadgeProps {
  readonly priority: FailurePriority;
  readonly size?: 'xs' | 'sm' | 'md';
  readonly showLabel?: boolean;
}

// ─── Component ────────────────────────────────────────────────
/**
 * Renders a priority badge for a failure group.
 * Returns null for UNKNOWN priority — no empty space is rendered.
 * BLOCKER pulses via CSS class; prefers-reduced-motion suppresses the animation.
 */
export function PriorityBadge({
  priority,
  size = 'sm',
  showLabel = true,
}: PriorityBadgeProps): React.ReactElement | null {
  if (priority === 'UNKNOWN') return null;

  const config = PRIORITY_DISPLAY[priority];
  const Icon = config.icon;

  if (!Icon) return null;

  const iconPx = size === 'xs' ? 10 : size === 'md' ? 14 : 12;

  return (
    <Badge
      size={size}
      variant="filled"
      className={priority === 'BLOCKER' ? styles.blocker : undefined}
      leftSection={<Icon size={iconPx} stroke={2} />}
      aria-label={showLabel ? undefined : `Priority: ${config.label}`}
      styles={{
        root: {
          backgroundColor: config.bg,
          color: config.fg,
          border: `1px solid ${config.border}`,
        },
        section: {
          color: config.fg,
          marginRight: showLabel ? 4 : 0,
        },
      }}
    >
      {showLabel ? config.label : null}
    </Badge>
  );
}
