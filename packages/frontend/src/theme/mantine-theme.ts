import { createTheme } from "@mantine/core";

// ─── PulsCI Theme ────────────────────────────────────────────
// Clean dark. High contrast. Every component matches.

export const colors = {
  bg: "#0F1117",
  bgGradient: "linear-gradient(180deg, #0F1117 0%, #13151D 100%)",
  surface: "rgba(22, 25, 34, 0.80)",
  surfaceHover: "rgba(30, 34, 44, 0.90)",
  surfaceSolid: "#181B25",
  surfaceLight: "#14161E",
  border: "rgba(255, 255, 255, 0.10)",
  borderHover: "rgba(245, 103, 64, 0.35)",

  text: "#EDEDEF",
  textSecondary: "#B3B6C2",
  textTertiary: "#7D8291",
  textMuted: "#555A6B",

  success: "#34D399",
  failure: "#F87171",
  critical: "#EF4444",
  warning: "#FBBF24",
  info: "#60A5FA",

  accent: "#F56740",
  accentLight: "#FF9A76",
  accentGradient: "linear-gradient(135deg, #F56740, #FF9A76)",
  accentMuted: "rgba(245, 103, 64, 0.12)",

  gradientMid: "#13151D",
  gradientEnd: "#1A1520",
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
  backgroundColor: colors.surfaceSolid,
  border: `1px solid ${colors.border}`,
  borderTop: "2px solid transparent",
  borderImage:
    "linear-gradient(90deg, rgba(245, 103, 64, 0.3) 0%, rgba(255, 154, 118, 0.1) 50%, transparent 100%) 1",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
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

export const metricStyle = {
  fontFamily:
    '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFeatureSettings: '"tnum"',
  fontWeight: 800,
  letterSpacing: "-0.02em",
} as const;

// ─── Mantine theme with full component overrides ─────────────
// Every component gets our colors. No Mantine brown/gray defaults leaking through.

const FONT =
  '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export const theme = createTheme({
  primaryColor: "orange",
  defaultRadius: "md",
  fontFamily: FONT,
  headings: { fontFamily: FONT, fontWeight: "700" },
  colors: {
    dark: [
      "#C1C2C5", // dark[0] — lightest text
      "#A6A7AB", // dark[1]
      "#909296", // dark[2]
      "#7D8291", // dark[3] — matches textTertiary
      "#555A6B", // dark[4] — matches textMuted
      "#2C2F3A", // dark[5] — component bg hover
      "#22252F", // dark[6] — component bg (inputs, selects, accordion)
      "#181B25", // dark[7] — card/surface bg
      "#13151D", // dark[8] — page bg
      "#0F1117", // dark[9] — deepest bg
    ],
  },
  components: {
    Card: {
      defaultProps: { bg: "dark.7" },
    },
    Paper: {
      defaultProps: { bg: "dark.7" },
    },
    Accordion: {
      styles: () => ({
        item: {
          backgroundColor: colors.surfaceSolid,
          borderColor: colors.border,
          "&[data-active]": { backgroundColor: colors.surfaceSolid },
        },
        control: {
          backgroundColor: "transparent",
          "&:hover": { backgroundColor: colors.surfaceHover },
        },
        panel: { backgroundColor: "transparent" },
        chevron: { color: colors.textTertiary },
      }),
    },
    Select: {
      styles: () => ({
        input: {
          backgroundColor: colors.surfaceSolid,
          borderColor: colors.border,
          color: colors.text,
          "&::placeholder": { color: colors.textMuted },
          "&:focus": { borderColor: colors.accent },
        },
        dropdown: {
          backgroundColor: colors.surfaceSolid,
          borderColor: colors.border,
        },
        option: {
          color: colors.text,
          "&[data-selected]": { backgroundColor: colors.accentMuted },
          "&[data-hovered]": { backgroundColor: colors.surfaceHover },
        },
      }),
    },
    TextInput: {
      styles: () => ({
        input: {
          backgroundColor: colors.surfaceSolid,
          borderColor: colors.border,
          color: colors.text,
          "&::placeholder": { color: colors.textMuted },
          "&:focus": { borderColor: colors.accent },
        },
        label: { color: colors.textSecondary },
      }),
    },
    PasswordInput: {
      styles: () => ({
        input: {
          backgroundColor: colors.surfaceSolid,
          borderColor: colors.border,
          color: colors.text,
          "&:focus-within": { borderColor: colors.accent },
        },
        innerInput: { color: colors.text },
        label: { color: colors.textSecondary },
      }),
    },
    SegmentedControl: {
      styles: () => ({
        root: {
          backgroundColor: colors.surfaceSolid,
          borderColor: colors.border,
        },
        indicator: { backgroundColor: colors.accent },
        label: {
          color: colors.textSecondary,
          "&[data-active]": { color: "#fff" },
        },
      }),
    },
    Badge: {
      styles: () => ({
        root: { fontWeight: 600 },
      }),
    },
    Modal: {
      styles: () => ({
        header: { backgroundColor: colors.surfaceSolid },
        body: { backgroundColor: colors.surfaceSolid },
        title: { color: colors.text, fontWeight: 600 },
      }),
    },
    Tooltip: {
      styles: () => ({
        tooltip: {
          backgroundColor: colors.surfaceSolid,
          color: colors.text,
          border: `1px solid ${colors.border}`,
        },
      }),
    },
    Loader: {
      defaultProps: { color: "orange", size: "sm" },
    },
    Button: {
      styles: () => ({
        root: { fontWeight: 600 },
      }),
    },
    Divider: {
      styles: () => ({
        root: { borderColor: colors.border },
      }),
    },
    ScrollArea: {
      styles: () => ({
        thumb: { backgroundColor: colors.textMuted },
      }),
    },
    Checkbox: {
      styles: () => ({
        input: {
          backgroundColor: colors.surfaceLight,
          borderColor: colors.border,
        },
      }),
    },
  },
});
