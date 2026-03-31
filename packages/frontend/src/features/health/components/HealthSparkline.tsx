import { Group, Box, Tooltip } from "@mantine/core";
import { colors, HEALTH_COLORS } from "../../../theme/mantine-theme";

interface HealthSparklineProps {
  readonly data: ReadonlyArray<{
    readonly score: number;
    readonly level: string;
    readonly recordedAt: string;
  }>;
}

const MAX_SCORE = 100;
const BAR_COUNT = 30;
const BAR_HEIGHT = 40;
const MIN_BAR_HEIGHT = 2;
const BAR_WIDTH = 6;
const BAR_RADIUS = 2;

/**
 * Mini bar chart showing recent health score history.
 * Each bar is colored by health level and sized by score.
 */
export function HealthSparkline({ data }: HealthSparklineProps) {
  if (data.length < 2) return null;

  return (
    <Group gap={1} align="flex-end" h={BAR_HEIGHT}>
      {data.slice(-BAR_COUNT).map((s, i) => {
        const height = Math.max(MIN_BAR_HEIGHT, (s.score / MAX_SCORE) * BAR_HEIGHT);
        const color = HEALTH_COLORS[s.level] ?? colors.textMuted;
        const time = new Date(s.recordedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <Tooltip key={i} label={`${time} — ${s.level} (${s.score})`}>
            <Box
              style={{
                width: BAR_WIDTH,
                height,
                backgroundColor: color,
                borderRadius: BAR_RADIUS,
                transition: "height 0.3s ease",
              }}
            />
          </Tooltip>
        );
      })}
    </Group>
  );
}
