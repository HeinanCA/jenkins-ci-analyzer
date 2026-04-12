import { createTheme } from "@mantine/core";

// ─── PulsCI Theme ────────────────────────────────────────────
// Jenkins-brightness dark. Readable first. Ember accent for signal.

export const colors = {
  bg: "#2B2B2B",
  bgGradient: "linear-gradient(180deg, #2B2B2B 0%, #2B2B2B 100%)",
  surface: "#333333",
  surfaceHover: "#3A3A3A",
  surfaceSolid: "#333333",
  surfaceLight: "#1F1F1F",
  border: "#444444",
  borderHover: "#555555",

  text: "#FFFFFF",
  textSecondary: "#CCCCCC",
  textTertiary: "#999999",
  textMuted: "#777777",

  success: "#4ADE80",
  failure: "#F87171",
  critical: "#EF4444",
  warning: "#FBBF24",
  info: "#60A5FA",

  accent: "#F56740",
  accentLight: "#FF9A76",
  accentGradient: "linear-gradient(135deg, #F56740, #FF9A76)",
  accentMuted: "rgba(245, 103, 64, 0.12)",
  accentGlow: "rgba(245, 103, 64, 0.4)",

  gradientMid: "#2B2B2B",
  gradientEnd: "#252525",
} as const;

export const HEALTH_COLORS: Record<string, string> = {
  healthy: colors.success,
  degraded: colors.warning,
  unhealthy: colors.failure,
  down: colors.critical,
};

export function statusGradient(color: string): string {
  return `linear-gradient(90deg, ${color}, transparent)`;
}

export const cardStyle: Record<string, string> = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  transition: "border-color 0.15s, background 0.15s, transform 0.15s",
  transform: "translateY(0)",
};

export const cardHoverStyle: Record<string, string> = {
  ...cardStyle,
  borderColor: colors.borderHover,
  background: colors.surfaceHover,
  transform: "translateY(-1px)",
};

export const codeStyle = {
  backgroundColor: colors.surfaceLight,
  border: `1px solid ${colors.border}`,
  fontSize: 13,
} as const;

export const metricStyle = {
  fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', monospace",
  fontFeatureSettings: '"tnum"',
  fontWeight: 700,
  letterSpacing: "-0.04em",
} as const;

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

export const theme = createTheme({
  primaryColor: "orange",
  defaultRadius: "md",
  fontFamily: FONT,
  headings: { fontFamily: FONT, fontWeight: "700" },
  colors: {
    dark: [
      "#FFFFFF",
      "#CCCCCC",
      "#999999",
      "#777777",
      "#555555",
      "#444444",
      "#3A3A3A",
      "#333333",
      "#2B2B2B",
      "#1F1F1F",
    ],
  },
});
