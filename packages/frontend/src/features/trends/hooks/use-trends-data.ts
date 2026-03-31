import { useQuery } from "@tanstack/react-query";
import { tigTrends } from "../../../api/tig-client";
import { REFETCH } from "../../../shared/constants";

interface UseTrendsDataParams {
  readonly instanceId: string | null;
  readonly days: number;
  readonly teamId: string | null;
}

/**
 * Fetches all four trend datasets in parallel.
 * Each query runs independently so a slow MTTR call doesn't block the hero chart.
 */
export function useTrendsData({ instanceId, days, teamId }: UseTrendsDataParams) {
  const iid = instanceId ?? undefined;
  const tid = teamId ?? undefined;

  const failureRate = useQuery({
    queryKey: ["trends-failure-rate", instanceId, days, teamId],
    queryFn: () => tigTrends.failureRate(days, iid, tid),
    refetchInterval: REFETCH.slow,
  });

  const buildFreq = useQuery({
    queryKey: ["trends-build-freq", instanceId, days, teamId],
    queryFn: () => tigTrends.buildFrequency(days, iid, tid),
    refetchInterval: REFETCH.slow,
  });

  const classification = useQuery({
    queryKey: ["trends-classification", instanceId, days, teamId],
    queryFn: () => tigTrends.classification(days, iid, tid),
    refetchInterval: REFETCH.slow,
  });

  const mttr = useQuery({
    queryKey: ["trends-mttr", instanceId, days, teamId],
    queryFn: () => tigTrends.mttr(Math.max(days, 14), iid, tid),
    refetchInterval: REFETCH.slow,
  });

  const isLoading = failureRate.isLoading || buildFreq.isLoading;
  const isError = failureRate.isError || buildFreq.isError;

  const refetch = () => {
    failureRate.refetch();
    buildFreq.refetch();
    classification.refetch();
    mttr.refetch();
  };

  return { failureRate, buildFreq, classification, mttr, isLoading, isError, refetch };
}
