import { Card, Text, Group } from "@mantine/core";
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
import { sum } from "../utils";
import { InsightHeader } from "./InsightHeader";

interface ClassificationEntry {
  readonly date: string;
  readonly code?: number;
  readonly infra?: number;
}

interface ClassificationCardProps {
  readonly data: readonly ClassificationEntry[];
  readonly periodLabel: string;
}

export function ClassificationCard({ data, periodLabel }: ClassificationCardProps) {
  const totalCode = sum(data.map((d) => d.code ?? 0));
  const totalInfra = sum(data.map((d) => d.infra ?? 0));
  const total = totalCode + totalInfra;
  const codePct = total > 0 ? Math.round((totalCode / total) * 100) : 0;

  return (
    <Card radius="md" style={cardStyle} p="md">
      <InsightHeader
        headline="Failure Classification"
        subtitle={
          total > 0
            ? `${codePct}% of failures are code issues your team can fix`
            : "No classified failures yet"
        }
        value={
          <Group gap={8}>
            <Text size="xs" fw={600} c={colors.warning} style={metricStyle}>
              {totalCode} code
            </Text>
            <Text size="xs" fw={600} c={colors.failure} style={metricStyle}>
              {totalInfra} infra
            </Text>
          </Group>
        }
        trend={null}
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
          <Bar dataKey="code" stackId="a" fill={colors.warning} name="Code" />
          <Bar dataKey="infra" stackId="a" fill={colors.failure} name="Infra" />
          <Legend wrapperStyle={{ fontSize: 11, color: colors.textTertiary }} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
