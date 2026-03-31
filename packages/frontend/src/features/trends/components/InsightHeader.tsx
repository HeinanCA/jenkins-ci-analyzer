import { Box, Group, Text } from "@mantine/core";
import { colors } from "../../../theme/mantine-theme";

interface InsightHeaderProps {
  readonly headline: string;
  readonly subtitle: string;
  readonly value: React.ReactNode;
  readonly trend: React.ReactNode;
}

export function InsightHeader({
  headline,
  subtitle,
  value,
  trend,
}: InsightHeaderProps) {
  return (
    <Box mb="sm">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Text size="sm" fw={600} c={colors.text}>
            {headline}
          </Text>
          <Text size="xs" c={colors.textTertiary}>
            {subtitle}
          </Text>
        </Box>
        <Box style={{ textAlign: "right" }}>
          {value}
          {trend}
        </Box>
      </Group>
    </Box>
  );
}
