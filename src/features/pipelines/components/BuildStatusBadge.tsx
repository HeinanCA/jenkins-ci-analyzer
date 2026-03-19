import { Badge } from '@mantine/core';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  blue: { color: 'green', label: 'Success' },
  blue_anime: { color: 'blue', label: 'Building' },
  green: { color: 'green', label: 'Success' },
  green_anime: { color: 'blue', label: 'Building' },
  red: { color: 'red', label: 'Failed' },
  red_anime: { color: 'blue', label: 'Building' },
  yellow: { color: 'yellow', label: 'Unstable' },
  yellow_anime: { color: 'blue', label: 'Building' },
  aborted: { color: 'gray', label: 'Aborted' },
  disabled: { color: 'gray', label: 'Disabled' },
  notbuilt: { color: 'gray', label: 'Not Built' },
};

interface Props {
  readonly color: string;
}

export function BuildStatusBadge({ color }: Props) {
  const status = STATUS_MAP[color] ?? { color: 'gray', label: color };

  return (
    <Badge color={status.color} variant="filled" size="sm">
      {status.label}
    </Badge>
  );
}
