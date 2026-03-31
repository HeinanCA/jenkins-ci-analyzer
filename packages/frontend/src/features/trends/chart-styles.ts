import { colors } from "../../theme/mantine-theme";

export const CHART_MARGIN = { top: 5, right: 5, left: -20, bottom: 0 };

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
  },
  labelStyle: { color: colors.text },
  itemStyle: { color: colors.textSecondary },
} as const;

export const GRID_STYLE = {
  horizontal: true,
  vertical: false,
  stroke: "rgba(255,255,255,0.03)",
} as const;

export const AXIS_TICK = { fill: colors.textMuted, fontSize: 11 } as const;
