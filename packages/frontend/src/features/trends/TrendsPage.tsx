import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Stack, SegmentedControl, SimpleGrid, Select } from "@mantine/core";
import { tigTeams } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import { colors } from "../../theme/mantine-theme";
import { LoadingState } from "../../shared/components/LoadingState";
import { QueryError } from "../../shared/components/QueryError";
import { PageHeader } from "../../shared/components/PageHeader";
import { useTrendsData } from "./hooks/use-trends-data";
import { normalizeMttrData } from "./components/MttrCard";
import { FailureRateCard } from "./components/FailureRateCard";
import { BuildFreqCard } from "./components/BuildFreqCard";
import { ClassificationCard } from "./components/ClassificationCard";
import { MttrCard } from "./components/MttrCard";

const PERIOD_OPTIONS = [
  { label: "7 days", value: "7" },
  { label: "14 days", value: "14" },
  { label: "30 days", value: "30" },
];

function periodToLabel(days: number): string {
  if (days <= 7) return "week";
  if (days <= 14) return "2 weeks";
  return "month";
}

export function TrendsPage() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const [period, setPeriod] = useState("7");
  const [teamId, setTeamId] = useState<string | null>(null);

  const days = Number(period);
  const periodLabel = periodToLabel(days);

  const { data: teamsData } = useQuery({
    queryKey: ["teams"],
    queryFn: () => tigTeams.list(),
  });

  const { failureRate, buildFreq, classification, mttr, isLoading, isError, refetch } =
    useTrendsData({ instanceId, days, teamId });

  if (isLoading) return <LoadingState />;

  if (isError) {
    const message = failureRate.error?.message || buildFreq.error?.message;
    return <QueryError message={message} onRetry={refetch} />;
  }

  const mttrData = normalizeMttrData(mttr.data ?? []);

  const teamSelector =
    teamsData && teamsData.length > 0 ? (
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
    ) : undefined;

  return (
    <Stack gap="lg">
      <PageHeader title="Trends" leftContent={teamSelector}>
        <SegmentedControl
          size="xs"
          value={period}
          onChange={setPeriod}
          data={PERIOD_OPTIONS}
          styles={{ root: { backgroundColor: colors.surface } }}
        />
      </PageHeader>

      <FailureRateCard
        data={failureRate.data ?? []}
        periodLabel={periodLabel}
      />

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <BuildFreqCard
          data={buildFreq.data ?? []}
          periodLabel={periodLabel}
        />
        <ClassificationCard
          data={classification.data ?? []}
          periodLabel={periodLabel}
        />
      </SimpleGrid>

      {mttrData.length > 0 && (
        <MttrCard data={mttrData} periodLabel={periodLabel} />
      )}
    </Stack>
  );
}
