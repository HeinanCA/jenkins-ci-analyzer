import { Text } from "@mantine/core";
import { colors, metricStyle } from "../../../theme/mantine-theme";

interface TrendIndicatorProps {
  readonly current: number;
  readonly previous: number;
  readonly unit: string;
  readonly upIsGood: boolean;
}

/** Direction arrow + color based on whether "up" is good or bad. */
export function TrendIndicator({
  current,
  previous,
  unit,
  upIsGood,
}: TrendIndicatorProps) {
  if (previous === 0) return null;

  const delta = current - previous;
  const pct = Math.abs(Math.round((delta / previous) * 100));
  if (pct === 0) return null;

  const isUp = delta > 0;
  const isGood = upIsGood ? isUp : !isUp;

  return (
    <Text
      size="xs"
      fw={600}
      c={isGood ? colors.success : colors.failure}
      style={metricStyle}
    >
      {isUp ? "\u2191" : "\u2193"} {pct}% from prev {unit}
    </Text>
  );
}
