import { createTheme } from "@mantine/core";

// ─── Atmosphere Theme ───────────────────────────────────────
// Warm dark. Like a terminal in a coffee shop.
// Accent: Ember — warm coral-orange. A pulse is warm.

export const colors = {
  // Backgrounds — warm charcoal base, cool slate glass for contrast
  bg: "#141210",
  bgGradient: "linear-gradient(180deg, #141210 0%, #1A1714 100%)",
  surface: "rgba(35, 38, 45, 0.55)",
  surfaceHover: "rgba(42, 45, 52, 0.65)",
  surfaceSolid: "#232830",
  surfaceLight: "#1C1E24",
  border: "rgba(200, 210, 230, 0.08)",
  borderHover: "rgba(245, 103, 64, 0.3)",

  // Text — warm whites instead of blue-whites
  text: "#EDE8E3",
  textSecondary: "#A59E95",
  textTertiary: "#7A736A",
  textMuted: "#524C45",

  // Status
  success: "#51E2B4",
  failure: "#FF6B6B",
  critical: "#EF4444",
  warning: "#FBBF24",
  info: "#60A5FA",

  // Accent — ember coral to soft peach
  accent: "#F56740",
  accentLight: "#FF9A76",
  accentGradient: "linear-gradient(135deg, #F56740, #FF9A76)",
  accentMuted: "rgba(245, 103, 64, 0.12)",

  // Gradients for login/special pages
  gradientMid: "#1A1714",
  gradientEnd: "#1F1610",
} as const;

export const HEALTH_COLORS: Record<string, string> = {
  healthy: colors.success,
  degraded: colors.warning,
  unhealthy: colors.failure,
  down: colors.critical,
} as const;

// Status bar gradient for card top edges
export function statusGradient(color: string): string {
  return `linear-gradient(90deg, ${color}, transparent)`;
}

// ─── Frosted glass card with ember glow on hover ───
export const cardStyle: Record<string, string> = {
  backgroundColor: colors.surface,
  backdropFilter: "blur(8px)",
  border: `1px solid ${colors.border}`,
  borderTop: "2px solid transparent",
  borderImage:
    "linear-gradient(90deg, rgba(245, 103, 64, 0.35) 0%, rgba(255, 154, 118, 0.12) 50%, transparent 100%) 1",
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
  fontSize: 12,
} as const;

// ─── Metric number styling (tabular figures, tight tracking) ───
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
