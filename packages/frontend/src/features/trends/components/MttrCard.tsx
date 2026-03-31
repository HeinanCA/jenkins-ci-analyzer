import { Card, Text } from "@mantine/core";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { colors, cardStyle, metricStyle } from "../../../theme/mantine-theme";
import { formatDate } from "../../../shared/utils/formatting";
import { CHART_MARGIN, CHART_TOOLTIP_STYLE, GRID_STYLE, AXIS_TICK } from "../chart-styles";
import { splitHalves, avg } from "../utils";
import { InsightHeader } from "./InsightHeader";
import { TrendIndicator } from "./TrendIndicator";

interface MttrEntry {
  readonly date: string;
  readonly avgRecoveryHours: number;
}

interface MttrCardProps {
  readonly data: readonly MttrEntry[];
  readonly periodLabel: string;
}

function formatMttr(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)} days`;
}

/** Normalize raw API response into a consistent shape. */
export function normalizeMttrData(
  raw: readonly Record<string, unknown>[],
): MttrEntry[] {
  return raw.map((d) => ({
    date: d.date as string,
    avgRecoveryHours:
      (d.avg_recovery_hours as number) ?? (d.avgRecoveryHours as number) ?? 0,
  }));
}

export function MttrCard({ data, periodLabel }: MttrCardProps) {
  const { prev, curr } = splitHalves(data);
  const currentMttr = avg(
    curr.map((d) => d.avgRecoveryHours).filter((v) => v > 0),
  );
  const prevMttr = avg(
    prev.map((d) => d.avgRecoveryHours).filter((v) => v > 0),
  );

  const mttrColor =
    currentMttr > 24
      ? colors.failure
      : currentMttr > 8
        ? colors.warning
        : colors.success;

  return (
    <Card radius="md" style={cardStyle} p="md">
      <InsightHeader
        headline="Mean Time to Recovery"
        subtitle={
          currentMttr > 0
            ? `It takes ~${formatMttr(currentMttr)} to fix a broken build`
            : "No recovery data yet"
        }
        value={
          currentMttr > 0 ? (
            <Text
              size="xl"
              fw={700}
              c={mttrColor}
              style={{ ...metricStyle, fontSize: 28 }}
            >
              {formatMttr(currentMttr)}
            </Text>
          ) : null
        }
        trend={
          <TrendIndicator
            current={currentMttr}
            previous={prevMttr}
            unit={periodLabel}
            upIsGood={false}
          />
        }
      />
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart
          data={data.map((d) => ({ ...d, date: formatDate(d.date) }))}
          margin={CHART_MARGIN}
        >
          <defs>
            <linearGradient id="mttrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.accent} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis dataKey="date" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} unit="h" />
          <Tooltip {...CHART_TOOLTIP_STYLE} />
          <Area
            type="monotone"
            dataKey="avgRecoveryHours"
            stroke={colors.accent}
            fill="url(#mttrGradient)"
            strokeWidth={2}
            name="MTTR (hours)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
