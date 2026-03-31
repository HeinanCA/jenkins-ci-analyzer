import { Card, Text } from "@mantine/core";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { colors, cardStyle, metricStyle } from "../../../theme/mantine-theme";
import { formatDate } from "../../../shared/utils/formatting";
import { CHART_MARGIN, CHART_TOOLTIP_STYLE, GRID_STYLE, AXIS_TICK } from "../chart-styles";
import { splitHalves, sum } from "../utils";
import { InsightHeader } from "./InsightHeader";
import { TrendIndicator } from "./TrendIndicator";

interface BuildFreqEntry {
  readonly date: string;
  readonly total?: number;
  readonly success?: number;
  readonly failure?: number;
}

interface BuildFreqCardProps {
  readonly data: readonly BuildFreqEntry[];
  readonly periodLabel: string;
}

export function BuildFreqCard({ data, periodLabel }: BuildFreqCardProps) {
  const { prev, curr } = splitHalves(data);
  const currentTotal = sum(curr.map((d) => d.total ?? 0));
  const prevTotal = sum(prev.map((d) => d.total ?? 0));
  const totalBuilds = sum(data.map((d) => d.total ?? 0));
  const avgPerDay = data.length > 0 ? Math.round(totalBuilds / data.length) : 0;

  return (
    <Card radius="md" style={cardStyle} p="md">
      <InsightHeader
        headline="Build Frequency"
        subtitle={`~${avgPerDay} builds per day`}
        value={
          <Text
            size="xl"
            fw={700}
            c={colors.text}
            style={{ ...metricStyle, fontSize: 28 }}
          >
            {totalBuilds}
          </Text>
        }
        trend={
          <TrendIndicator
            current={currentTotal}
            previous={prevTotal}
            unit={periodLabel}
            upIsGood={true}
          />
        }
      />
      <ResponsiveContainer width="100%" height={160}>
        <BarChart
          data={data.map((d) => ({ ...d, date: formatDate(d.date) }))}
          margin={CHART_MARGIN}
        >
          <CartesianGrid {...GRID_STYLE} />
          <XAxis dataKey="date" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
            labelStyle={CHART_TOOLTIP_STYLE.labelStyle}
          />
          <Bar
            dataKey="success"
            stackId="a"
            fill={colors.success}
            name="Passed"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="failure"
            stackId="a"
            fill={colors.failure}
            name="Failed"
            radius={[4, 4, 0, 0]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: colors.textTertiary }} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
