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
import { splitHalves, avg, sum } from "../utils";
import { InsightHeader } from "./InsightHeader";
import { TrendIndicator } from "./TrendIndicator";

interface FailureRateEntry {
  readonly date: string;
  readonly rate?: number;
  readonly failed?: number;
  readonly total?: number;
}

interface FailureRateCardProps {
  readonly data: readonly FailureRateEntry[];
  readonly periodLabel: string;
}

export function FailureRateCard({ data, periodLabel }: FailureRateCardProps) {
  const { prev, curr } = splitHalves(data);
  const currentRate = avg(curr.map((d) => d.rate ?? 0));
  const prevRate = avg(prev.map((d) => d.rate ?? 0));
  const totalFailed = sum(data.map((d) => d.failed ?? 0));
  const total = sum(data.map((d) => d.total ?? 0));

  const rateColor =
    currentRate > 20
      ? colors.failure
      : currentRate > 10
        ? colors.warning
        : colors.success;

  return (
    <Card radius="md" style={cardStyle} p="md">
      <InsightHeader
        headline="Failure Rate"
        subtitle={
          total > 0
            ? `${totalFailed} of ${total} builds failed this ${periodLabel}`
            : `No builds this ${periodLabel}`
        }
        value={
          <Text
            size="xl"
            fw={700}
            c={rateColor}
            style={{ ...metricStyle, fontSize: 28 }}
          >
            {currentRate.toFixed(1)}%
          </Text>
        }
        trend={
          <TrendIndicator
            current={currentRate}
            previous={prevRate}
            unit={periodLabel}
            upIsGood={false}
          />
        }
      />
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart
          data={data.map((d) => ({ ...d, date: formatDate(d.date) }))}
          margin={CHART_MARGIN}
        >
          <defs>
            <linearGradient id="failureGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.failure} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors.failure} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis dataKey="date" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} unit="%" />
          <Tooltip {...CHART_TOOLTIP_STYLE} />
          <Area
            type="monotone"
            dataKey="rate"
            stroke={colors.failure}
            fill="url(#failureGradient)"
            strokeWidth={2}
            name="Failure Rate %"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
