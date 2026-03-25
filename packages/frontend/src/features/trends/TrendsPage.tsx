import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Stack,
  Title,
  Text,
  Card,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Box,
  Select,
} from "@mantine/core";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { tigTrends, tigTeams } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import { colors, cardStyle, metricStyle } from "../../theme/mantine-theme";
import { QueryError } from "../../shared/components/QueryError";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Split data in half: first half = previous period, second half = current period
function splitHalves<T>(data: T[]): { prev: T[]; curr: T[] } {
  const mid = Math.ceil(data.length / 2);
  return { prev: data.slice(0, mid), curr: data.slice(mid) };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// Direction arrow + color based on whether "up" is good or bad
function TrendIndicator({
  current,
  previous,
  unit,
  upIsGood,
}: {
  current: number;
  previous: number;
  unit: string;
  upIsGood: boolean;
}) {
  if (previous === 0) return null;
  const delta = current - previous;
  const pct = Math.abs(Math.round((delta / previous) * 100));
  if (pct === 0) return null;

  const isUp = delta > 0;
  const isGood = upIsGood ? isUp : !isUp;

  return (
    <Text
      size="xs"
      fw={600}
      c={isGood ? colors.success : colors.failure}
      style={metricStyle}
    >
      {isUp ? "↑" : "↓"} {pct}% from prev {unit}
    </Text>
  );
}

function InsightHeader({
  headline,
  subtitle,
  value,
  trend,
}: {
  headline: string;
  subtitle: string;
  value: React.ReactNode;
  trend: React.ReactNode;
}) {
  return (
    <Box mb="sm">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Text size="sm" fw={600} c={colors.text}>
            {headline}
          </Text>
          <Text size="xs" c={colors.textTertiary}>
            {subtitle}
          </Text>
        </Box>
        <Box style={{ textAlign: "right" }}>
          {value}
          {trend}
        </Box>
      </Group>
    </Box>
  );
}

export function TrendsPage() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const [period, setPeriod] = useState("7");
  const [teamId, setTeamId] = useState<string | null>(null);

  const days = Number(period);
  const tid = teamId ?? undefined;
  const iid = instanceId ?? undefined;

  const { data: teamsData } = useQuery({
    queryKey: ["teams"],
    queryFn: () => tigTeams.list(),
  });

  const failureRate = useQuery({
    queryKey: ["trends-failure-rate", instanceId, days, teamId],
    queryFn: () => tigTrends.failureRate(days, iid, tid),
  });

  const buildFreq = useQuery({
    queryKey: ["trends-build-freq", instanceId, days, teamId],
    queryFn: () => tigTrends.buildFrequency(days, iid, tid),
  });

  const classification = useQuery({
    queryKey: ["trends-classification", instanceId, days, teamId],
    queryFn: () => tigTrends.classification(days, iid, tid),
  });

  const mttr = useQuery({
    queryKey: ["trends-mttr", instanceId, days, teamId],
    queryFn: () => tigTrends.mttr(Math.max(days, 14), iid, tid),
  });

  const isLoading = failureRate.isLoading || buildFreq.isLoading;
  const isError = failureRate.isError || buildFreq.isError;

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader color="orange" size="sm" />
      </Stack>
    );
  }

  if (isError) {
    const errorMessage = failureRate.error?.message || buildFreq.error?.message;
    const retry = () => {
      failureRate.refetch();
      buildFreq.refetch();
    };
    return <QueryError message={errorMessage} onRetry={retry} />;
  }

  const chartMargin = { top: 5, right: 5, left: -20, bottom: 0 };
  const periodLabel = days <= 7 ? "week" : days <= 14 ? "2 weeks" : "month";

  // Compute insights
  const frData = failureRate.data ?? [];
  const frSplit = splitHalves(frData);
  const frCurrentRate = avg(frSplit.curr.map((d) => d.rate ?? 0));
  const frPrevRate = avg(frSplit.prev.map((d) => d.rate ?? 0));
  const frTotalFailed = sum(frData.map((d) => d.failed ?? 0));
  const frTotal = sum(frData.map((d) => d.total ?? 0));

  const bfData = buildFreq.data ?? [];
  const bfSplit = splitHalves(bfData);
  const bfCurrentTotal = sum(bfSplit.curr.map((d) => d.total ?? 0));
  const bfPrevTotal = sum(bfSplit.prev.map((d) => d.total ?? 0));
  const bfTotalBuilds = sum(bfData.map((d) => d.total ?? 0));
  const bfAvgPerDay =
    bfData.length > 0 ? Math.round(bfTotalBuilds / bfData.length) : 0;

  const clData = classification.data ?? [];
  const clTotalCode = sum(clData.map((d) => d.code ?? 0));
  const clTotalInfra = sum(clData.map((d) => d.infra ?? 0));
  const clTotal = clTotalCode + clTotalInfra;
  const clCodePct = clTotal > 0 ? Math.round((clTotalCode / clTotal) * 100) : 0;

  const mttrData = (mttr.data ?? []).map((d: Record<string, unknown>) => ({
    ...d,
    date: d.date as string,
    avgRecoveryHours:
      (d.avg_recovery_hours as number) ?? (d.avgRecoveryHours as number) ?? 0,
  }));
  const mttrSplit = splitHalves(mttrData);
  const mttrCurrent = avg(
    mttrSplit.curr.map((d) => d.avgRecoveryHours).filter((v) => v > 0),
  );
  const mttrPrev = avg(
    mttrSplit.prev.map((d) => d.avgRecoveryHours).filter((v) => v > 0),
  );

  function formatMttr(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)}min`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)} days`;
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="sm">
          <Title order={3} c={colors.text}>
            Trends
          </Title>
          {teamsData && teamsData.length > 0 && (
            <Select
              size="xs"
              placeholder="All teams"
              clearable
              value={teamId}
              onChange={setTeamId}
              data={teamsData.map((t) => ({ value: t.id, label: t.name }))}
              styles={{
                input: {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                  minWidth: 140,
                },
              }}
            />
          )}
        </Group>
        <SegmentedControl
          size="xs"
          value={period}
          onChange={setPeriod}
          data={[
            { label: "7 days", value: "7" },
            { label: "14 days", value: "14" },
            { label: "30 days", value: "30" },
          ]}
          styles={{ root: { backgroundColor: colors.surface } }}
        />
      </Group>

      {/* Hero chart: Failure Rate */}
      <Card radius="md" style={cardStyle} p="md">
        <InsightHeader
          headline="Failure Rate"
          subtitle={
            frTotal > 0
              ? `${frTotalFailed} of ${frTotal} builds failed this ${periodLabel}`
              : `No builds this ${periodLabel}`
          }
          value={
            <Text
              size="xl"
              fw={700}
              c={
                frCurrentRate > 20
                  ? colors.failure
                  : frCurrentRate > 10
                    ? colors.warning
                    : colors.success
              }
              style={{ ...metricStyle, fontSize: 28 }}
            >
              {frCurrentRate.toFixed(1)}%
            </Text>
          }
          trend={
            <TrendIndicator
              current={frCurrentRate}
              previous={frPrevRate}
              unit={periodLabel}
              upIsGood={false}
            />
          }
        />
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart
            data={frData.map((d) => ({ ...d, date: formatDate(d.date) }))}
            margin={chartMargin}
          >
            <defs>
              <linearGradient id="failureGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={colors.failure}
                  stopOpacity={0.3}
                />
                <stop offset="95%" stopColor={colors.failure} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              horizontal
              vertical={false}
              stroke="rgba(255,255,255,0.03)"
            />
            <XAxis
              dataKey="date"
              tick={{ fill: colors.textMuted, fontSize: 11 }}
            />
            <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
              }}
              labelStyle={{ color: colors.text }}
              itemStyle={{ color: colors.textSecondary }}
            />
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

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {/* Build Frequency */}
        <Card radius="md" style={cardStyle} p="md">
          <InsightHeader
            headline="Build Frequency"
            subtitle={`~${bfAvgPerDay} builds per day`}
            value={
              <Text
                size="xl"
                fw={700}
                c={colors.text}
                style={{ ...metricStyle, fontSize: 28 }}
              >
                {bfTotalBuilds}
              </Text>
            }
            trend={
              <TrendIndicator
                current={bfCurrentTotal}
                previous={bfPrevTotal}
                unit={periodLabel}
                upIsGood={true}
              />
            }
          />
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={bfData.map((d) => ({ ...d, date: formatDate(d.date) }))}
              margin={chartMargin}
            >
              <CartesianGrid
                horizontal
                vertical={false}
                stroke="rgba(255,255,255,0.03)"
              />
              <XAxis
                dataKey="date"
                tick={{ fill: colors.textMuted, fontSize: 11 }}
              />
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                }}
                labelStyle={{ color: colors.text }}
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
              <Legend
                wrapperStyle={{ fontSize: 11, color: colors.textTertiary }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Classification */}
        <Card radius="md" style={cardStyle} p="md">
          <InsightHeader
            headline="Failure Classification"
            subtitle={
              clTotal > 0
                ? `${clCodePct}% of failures are code issues your team can fix`
                : "No classified failures yet"
            }
            value={
              <Group gap={8}>
                <Text size="xs" fw={600} c={colors.warning} style={metricStyle}>
                  {clTotalCode} code
                </Text>
                <Text size="xs" fw={600} c={colors.failure} style={metricStyle}>
                  {clTotalInfra} infra
                </Text>
              </Group>
            }
            trend={null}
          />
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={clData.map((d) => ({ ...d, date: formatDate(d.date) }))}
              margin={chartMargin}
            >
              <CartesianGrid
                horizontal
                vertical={false}
                stroke="rgba(255,255,255,0.03)"
              />
              <XAxis
                dataKey="date"
                tick={{ fill: colors.textMuted, fontSize: 11 }}
              />
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                }}
                labelStyle={{ color: colors.text }}
              />
              <Bar
                dataKey="code"
                stackId="a"
                fill={colors.warning}
                name="Code"
              />
              <Bar
                dataKey="infra"
                stackId="a"
                fill={colors.failure}
                name="Infra"
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: colors.textTertiary }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </SimpleGrid>

      {/* MTTR */}
      {mttrData.length > 0 && (
        <Card radius="md" style={cardStyle} p="md">
          <InsightHeader
            headline="Mean Time to Recovery"
            subtitle={
              mttrCurrent > 0
                ? `It takes ~${formatMttr(mttrCurrent)} to fix a broken build`
                : "No recovery data yet"
            }
            value={
              mttrCurrent > 0 ? (
                <Text
                  size="xl"
                  fw={700}
                  c={
                    mttrCurrent > 24
                      ? colors.failure
                      : mttrCurrent > 8
                        ? colors.warning
                        : colors.success
                  }
                  style={{ ...metricStyle, fontSize: 28 }}
                >
                  {formatMttr(mttrCurrent)}
                </Text>
              ) : null
            }
            trend={
              <TrendIndicator
                current={mttrCurrent}
                previous={mttrPrev}
                unit={periodLabel}
                upIsGood={false}
              />
            }
          />
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart
              data={mttrData.map((d) => ({ ...d, date: formatDate(d.date) }))}
              margin={chartMargin}
            >
              <defs>
                <linearGradient id="mttrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={colors.accent}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={colors.accent}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                horizontal
                vertical={false}
                stroke="rgba(255,255,255,0.03)"
              />
              <XAxis
                dataKey="date"
                tick={{ fill: colors.textMuted, fontSize: 11 }}
              />
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} unit="h" />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                }}
                labelStyle={{ color: colors.text }}
                itemStyle={{ color: colors.textSecondary }}
              />
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
      )}
    </Stack>
  );
}
