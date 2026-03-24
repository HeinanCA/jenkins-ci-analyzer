import { createTheme } from '@mantine/core';

// ─── Atmosphere Theme ───────────────────────────────────────
// Deep, layered, alive. The product breathes.

export const colors = {
  // Backgrounds — deep navy-black with depth
  bg: '#0C0E16',
  bgGradient: 'linear-gradient(180deg, #0C0E16 0%, #111420 100%)',
  surface: '#161926',
  surfaceHover: '#1C1F2E',
  surfaceLight: '#121520',
  border: 'rgba(255, 255, 255, 0.06)',
  borderHover: 'rgba(255, 255, 255, 0.1)',

  // Text
  text: '#E4E6EF',
  textSecondary: '#9194A5',
  textTertiary: '#6B6F85',
  textMuted: '#4A4E63',

  // Status
  success: '#51E2B4',
  failure: '#FF6B6B',
  critical: '#EF4444',
  warning: '#FBBF24',
  info: '#60A5FA',

  // Accent — violet to lavender
  accent: '#6C5CE7',
  accentLight: '#A78BFA',
  accentGradient: 'linear-gradient(135deg, #6C5CE7, #A78BFA)',

  // Gradients for login/special pages
  gradientMid: '#111420',
  gradientEnd: '#0f1a3a',
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

export const cardStyle = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
} as const;

export const cardHoverStyle = {
  ...cardStyle,
  borderColor: colors.borderHover,
} as const;

export const codeStyle = {
  backgroundColor: colors.surfaceLight,
  border: `1px solid ${colors.border}`,
  fontSize: 12,
} as const;

export const theme = createTheme({
  primaryColor: 'violet',
  defaultRadius: 'md',
  fontFamily:
    '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily:
      '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: '700',
  },
});
