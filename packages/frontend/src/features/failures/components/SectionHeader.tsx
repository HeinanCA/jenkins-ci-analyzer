import { Group, Loader, Text } from '@mantine/core';
import { colors } from '../../../theme/mantine-theme';

type Variant = 'fixed' | 'building' | 'failing';

interface SectionHeaderProps {
  readonly variant: Variant;
  readonly count: number;
}

const VARIANT_CONFIG: Record<
  Variant,
  { color: string; icon: string; label: string }
> = {
  fixed: {
    color: colors.success,
    icon: '✓',
    label: 'Recently fixed',
  },
  building: {
    color: colors.accent,
    icon: '◎',
    label: 'Building',
  },
  failing: {
    color: colors.failure,
    icon: '●',
    label: 'Failing',
  },
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function SectionHeader({ variant, count }: SectionHeaderProps) {
  const cfg = VARIANT_CONFIG[variant];

  return (
    <Group
      gap={8}
      py={8}
      px={12}
      style={{
        borderRadius: 6,
        backgroundColor:
          variant === 'fixed'
            ? 'rgba(74, 222, 128, 0.06)'
            : variant === 'building'
              ? 'rgba(245, 103, 64, 0.06)'
              : 'rgba(248, 113, 113, 0.06)',
        border: `1px solid ${
          variant === 'fixed'
            ? 'rgba(74, 222, 128, 0.15)'
            : variant === 'building'
              ? 'rgba(245, 103, 64, 0.15)'
              : 'rgba(248, 113, 113, 0.15)'
        }`,
      }}
    >
      {variant === 'building' ? (
        <Loader size={12} color={cfg.color} />
      ) : (
        <Text size="sm" c={cfg.color} fw={700}>
          {cfg.icon}
        </Text>
      )}
      <Text size="sm" fw={600} c={cfg.color}>
        {cfg.label} — {plural(count, 'job')}
      </Text>
    </Group>
  );
}
