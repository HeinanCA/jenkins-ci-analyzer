import { createTheme } from "@mantine/core";

// ─── PulsCI Theme ────────────────────────────────────────────
// Clean dark. High contrast. Readable at a glance.
// Accent: Ember coral. Status colors are vivid.

export const colors = {
  // Backgrounds — true dark, not muddy brown
  bg: "#0F1117",
  bgGradient: "linear-gradient(180deg, #0F1117 0%, #13151D 100%)",
  surface: "rgba(25, 28, 36, 0.75)",
  surfaceHover: "rgba(32, 35, 44, 0.85)",
  surfaceSolid: "#191C24",
  surfaceLight: "#15171F",
  border: "rgba(255, 255, 255, 0.08)",
  borderHover: "rgba(245, 103, 64, 0.35)",

  // Text — clean whites with real contrast (WCAG AA compliant)
  text: "#F0F0F3",
  textSecondary: "#B0B4C0",
  textTertiary: "#787E8F",
  textMuted: "#505668",

  // Status — vivid, distinct
  success: "#34D399",
  failure: "#F87171",
  critical: "#EF4444",
  warning: "#FBBF24",
  info: "#60A5FA",

  // Accent — ember coral
  accent: "#F56740",
  accentLight: "#FF9A76",
  accentGradient: "linear-gradient(135deg, #F56740, #FF9A76)",
  accentMuted: "rgba(245, 103, 64, 0.12)",

  // Gradients for login/special pages
  gradientMid: "#13151D",
  gradientEnd: "#1A1520",
} as const;

export const HEALTH_COLORS: Record<string, string> = {
  healthy: colors.success,
  degraded: colors.warning,
  unhealthy: colors.failure,
  down: colors.critical,
} as const;

export function statusGradient(color: string): string {
  return `linear-gradient(90deg, ${color}, transparent)`;
}

// ─── Card styles ─────────────────────────────────────────────
export const cardStyle: Record<string, string> = {
  backgroundColor: colors.surface,
  backdropFilter: "blur(8px)",
  border: `1px solid ${colors.border}`,
  borderTop: "2px solid transparent",
  borderImage:
    "linear-gradient(90deg, rgba(245, 103, 64, 0.3) 0%, rgba(255, 154, 118, 0.1) 50%, transparent 100%) 1",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
  transition:
    "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
  transform: "translateY(0)",
};

export const cardHoverStyle: Record<string, string> = {
  ...cardStyle,
  borderColor: colors.borderHover,
  boxShadow: "0 4px 16px rgba(245, 103, 64, 0.08)",
  transform: "translateY(-1px)",
};

export const codeStyle = {
  backgroundColor: colors.surfaceLight,
  border: `1px solid ${colors.border}`,
  fontSize: 13,
} as const;

// ─── Metric numbers ──────────────────────────────────────────
export const metricStyle = {
  fontFamily:
    '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFeatureSettings: '"tnum"',
  fontWeight: 800,
  letterSpacing: "-0.02em",
} as const;

export const theme = createTheme({
  primaryColor: "orange",
  defaultRadius: "md",
  fontFamily:
    '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily:
      '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: "700",
  },
});
