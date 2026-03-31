import { Card, Text, Group } from "@mantine/core";
import { colors, cardStyle, cardHoverStyle, metricStyle } from "../../theme/mantine-theme";
import { useHover } from "../hooks/use-hover";

interface MetricCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly suffix?: string;
  readonly color?: string;
  readonly onClick?: () => void;
}

/**
 * Stat card with branded metric number.
 * Replaces the copy-pasted Card + Text + Text pattern used 15+ times.
 */
export function MetricCard({ label, value, suffix, color, onClick }: MetricCardProps) {
  const { hovered, bind } = useHover<"card">();
  const isHovered = hovered === "card";

  return (
    <Card
      radius="md"
      p="sm"
      style={{
        ...(isHovered ? cardHoverStyle : cardStyle),
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      {...bind("card")}
    >
      <Text size="xs" c={colors.textTertiary}>
        {label}
      </Text>
      <Group gap={4} align="baseline">
        <Text style={{ ...metricStyle, fontSize: 28, color: color ?? colors.text }}>
          {value}
        </Text>
        {suffix && (
          <Text size="xs" c={colors.textMuted}>
            {suffix}
          </Text>
        )}
      </Group>
    </Card>
  );
}
