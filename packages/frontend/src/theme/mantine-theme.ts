import { createTheme } from "@mantine/core";

// PulsCI color palette — single source of truth
export const colors = {
  bg: "#0f1117",
  surface: "#1e2030",
  surfaceLight: "#161822",
  border: "#2d3148",
  text: "#e2e8f0",
  textSecondary: "#94a3b8",
  textTertiary: "#64748b",
  textMuted: "#475569",
  lineNumber: "#666666",
  success: "#34d399",
  failure: "#f87171",
  critical: "#ef4444",
  warning: "#fbbf24",
  info: "#60a5fa",
  accent: "#a78bfa",
  gradientMid: "#1a1a2e",
  gradientEnd: "#0f3460",
} as const;

export const HEALTH_COLORS: Record<string, string> = {
  healthy: colors.success,
  degraded: colors.warning,
  unhealthy: colors.failure,
  down: colors.critical,
} as const;

export const cardStyle = {
  backgroundColor: colors.surface,
  border: "none",
} as const;

export const codeStyle = {
  backgroundColor: colors.surfaceLight,
  border: "none",
  fontSize: 12,
} as const;

export const theme = createTheme({
  primaryColor: "violet",
  defaultRadius: "md",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
});
