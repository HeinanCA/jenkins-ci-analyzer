import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Card,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
} from '@mantine/core';
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
} from 'recharts';
import { tigTrends } from '../../api/tig-client';
import { useAuthStore } from '../../store/auth-store';
import { colors, cardStyle } from '../../theme/mantine-theme';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function TrendsPage() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const [period, setPeriod] = useState('7');

  const days = Number(period);

  const failureRate = useQuery({
    queryKey: ['trends-failure-rate', instanceId, days],
    queryFn: () => tigTrends.failureRate(days, instanceId ?? undefined),
  });

  const buildFreq = useQuery({
    queryKey: ['trends-build-freq', instanceId, days],
    queryFn: () => tigTrends.buildFrequency(days, instanceId ?? undefined),
  });

  const classification = useQuery({
    queryKey: ['trends-classification', instanceId, days],
    queryFn: () => tigTrends.classification(days, instanceId ?? undefined),
  });

  const mttr = useQuery({
    queryKey: ['trends-mttr', instanceId, days],
    queryFn: () => tigTrends.mttr(Math.max(days, 14), instanceId ?? undefined),
  });

  const isLoading = failureRate.isLoading || buildFreq.isLoading;

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader color="violet" size="sm" />
      </Stack>
    );
  }

  const chartMargin = { top: 5, right: 5, left: -20, bottom: 0 };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={3} c={colors.text}>Trends</Title>
        <SegmentedControl
          size="xs"
          value={period}
          onChange={setPeriod}
          data={[
            { label: '7 days', value: '7' },
            { label: '14 days', value: '14' },
            { label: '30 days', value: '30' },
          ]}
          styles={{ root: { backgroundColor: colors.surface } }}
        />
      </Group>

      {/* Hero chart: Failure Rate */}
      <Card radius="md" style={cardStyle} p="md">
        <Text size="sm" fw={600} c={colors.text} mb="sm">Failure Rate</Text>
        <Text size="xs" c={colors.textTertiary} mb="md">
          Percentage of builds that failed, per day
        </Text>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={(failureRate.data ?? []).map((d) => ({ ...d, date: formatDate(d.date) }))} margin={chartMargin}>
            <defs>
              <linearGradient id="failureGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.failure} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colors.failure} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
            <XAxis dataKey="date" tick={{ fill: colors.textMuted, fontSize: 11 }} />
            <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }}
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
          <Text size="sm" fw={600} c={colors.text} mb="sm">Build Frequency</Text>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={(buildFreq.data ?? []).map((d) => ({ ...d, date: formatDate(d.date) }))} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis dataKey="date" tick={{ fill: colors.textMuted, fontSize: 11 }} />
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }}
                labelStyle={{ color: colors.text }}
              />
              <Bar dataKey="success" stackId="a" fill={colors.success} name="Passed" radius={[0, 0, 0, 0]} />
              <Bar dataKey="failure" stackId="a" fill={colors.failure} name="Failed" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 11, color: colors.textTertiary }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Classification */}
        <Card radius="md" style={cardStyle} p="md">
          <Text size="sm" fw={600} c={colors.text} mb="sm">Failure Classification</Text>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={(classification.data ?? []).map((d) => ({ ...d, date: formatDate(d.date) }))} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis dataKey="date" tick={{ fill: colors.textMuted, fontSize: 11 }} />
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }}
                labelStyle={{ color: colors.text }}
              />
              <Bar dataKey="code" stackId="a" fill={colors.warning} name="Code" />
              <Bar dataKey="infra" stackId="a" fill={colors.failure} name="Infra" />
              <Legend wrapperStyle={{ fontSize: 11, color: colors.textTertiary }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </SimpleGrid>

      {/* MTTR */}
      {mttr.data && mttr.data.length > 0 && (
        <Card radius="md" style={cardStyle} p="md">
          <Text size="sm" fw={600} c={colors.text} mb="sm">Mean Time to Recovery</Text>
          <Text size="xs" c={colors.textTertiary} mb="md">
            Average hours from failure to next successful build
          </Text>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={mttr.data.map((d) => ({ ...d, date: formatDate(d.date) }))} margin={chartMargin}>
              <defs>
                <linearGradient id="mttrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={colors.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis dataKey="date" tick={{ fill: colors.textMuted, fontSize: 11 }} />
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} unit="h" />
              <Tooltip
                contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }}
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
