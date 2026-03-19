import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Stack,
  Title,
  Text,
  Group,
  Loader,
  Alert,
  Breadcrumbs,
  Anchor,
  Divider,
} from "@mantine/core";
import { useBuildLog } from "../hooks/use-build-log";
import { analyzeLog, classifyFailure, FAILURE_PATTERNS } from "@tig/shared";
import { FailureSummaryCard } from "../components/FailureSummaryCard";
import { InfraCodeBadge } from "../components/InfraCodeBadge";
import { RemediationPanel } from "../components/RemediationPanel";
import { LogViewer } from "../components/LogViewer";
import { ErrorBoundary } from "../../../shared/components/ErrorBoundary";

export function BuildAnalysisPage() {
  const { jobPath: encodedJobPath, build } = useParams<{
    jobPath: string;
    build: string;
  }>();

  const jobPath = decodeURIComponent(encodedJobPath ?? "");
  const buildNumber = Number(build);
  const jobName = jobPath.split("/").pop() ?? jobPath;

  const { data: log, isLoading, error } = useBuildLog(jobPath, buildNumber);

  const analysis = useMemo(() => {
    if (!log) return null;
    const matches = analyzeLog(log, FAILURE_PATTERNS);
    const classification = classifyFailure(matches);
    return { matches, classification };
  }, [log]);

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text size="sm" c="dimmed">
          Fetching build log and analyzing...
        </Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Failed to load build log">
        <Text size="sm">
          {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Alert>
    );
  }

  return (
    <Stack gap="lg" p="md">
      <Breadcrumbs>
        <Anchor component={Link} to="/pipelines" size="sm">
          Pipelines
        </Anchor>
        <Text size="sm">{jobPath}</Text>
        <Text size="sm">#{build}</Text>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>
            {jobName} #{build}
          </Title>
          <Text size="sm" c="dimmed">
            {jobPath}
          </Text>
        </div>
        {analysis && (
          <InfraCodeBadge classification={analysis.classification} />
        )}
      </Group>

      <ErrorBoundary fallbackMessage="Failed to render failure analysis">
        {analysis && (
          <>
            <FailureSummaryCard matches={analysis.matches} />
            {analysis.matches.length > 0 && (
              <RemediationPanel primaryMatch={analysis.matches[0]} />
            )}
          </>
        )}
      </ErrorBoundary>

      <Divider />

      <ErrorBoundary fallbackMessage="Failed to render log viewer">
        <Title order={4}>Build Log</Title>
        {log && (
          <LogViewer
            log={log}
            highlightLine={analysis?.matches[0]?.lineNumber}
          />
        )}
      </ErrorBoundary>
    </Stack>
  );
}
