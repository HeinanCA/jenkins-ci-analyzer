import { Box } from "@mantine/core";
import { colors } from "../../theme/mantine-theme";

interface StatusDotProps {
  readonly status: "online" | "offline" | "healthy" | "degraded" | "unhealthy";
  readonly size?: number;
  readonly glow?: boolean;
}

const STATUS_MAP: Record<string, string> = {
  online: colors.success,
  healthy: colors.success,
  degraded: colors.warning,
  offline: colors.failure,
  unhealthy: colors.failure,
};

/**
 * Colored status indicator dot. Used in health, executor, and nav.
 */
export function StatusDot({ status, size = 8, glow = false }: StatusDotProps) {
  const color = STATUS_MAP[status] ?? colors.textMuted;
  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        boxShadow: glow ? `0 0 8px ${color}80` : undefined,
        flexShrink: 0,
      }}
    />
  );
}
