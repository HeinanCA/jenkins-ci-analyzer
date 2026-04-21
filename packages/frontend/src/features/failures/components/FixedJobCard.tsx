import { useEffect, useRef } from 'react';
import {
  Accordion,
  Badge,
  Box,
  Divider,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { colors } from '../../../theme/mantine-theme';
import { FailureDetail } from './FailureDetail';
import type { JobFailureGroup, FailureEntry } from '../types';

interface FixedJobCardProps {
  readonly group: JobFailureGroup;
  readonly isHovered: boolean;
  readonly onHover: {
    readonly onMouseEnter: () => void;
    readonly onMouseLeave: () => void;
  };
  readonly onVisible: (buildId: string) => void;
}

const DWELL_MS = 1500;

/** Converts a BuildRow to a FailureEntry for FailureDetail compatibility */
function buildRowToEntry(b: JobFailureGroup['latestBuild']): FailureEntry {
  return {
    buildId: b.buildId,
    buildNumber: b.buildNumber,
    result: b.result,
    startedAt: b.startedAt,
    durationMs: b.durationMs,
    jobName: b.jobName,
    jobFullPath: b.jobFullPath,
    analysisId: b.analysisId,
    classification: b.classification,
    confidence: b.confidence,
    matches: b.matches,
    triggeredBy: b.triggeredBy,
    jobUrl: b.jobUrl,
    gitSha: b.gitSha,
    gitRemoteUrl: b.gitRemoteUrl,
    aiSummary: b.aiSummary,
    aiRootCause: b.aiRootCause,
    aiSuggestedFixes: b.aiSuggestedFixes,
    logNoisePercent: b.logNoisePercent,
    logTopNoise: b.logTopNoise,
  };
}

export function FixedJobCard({
  group,
  isHovered,
  onHover,
  onVisible,
}: FixedJobCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          dwellTimerRef.current = setTimeout(() => {
            onVisibleRef.current(group.latestBuild.buildId);
          }, DWELL_MS);
        } else {
          if (dwellTimerRef.current !== null) {
            clearTimeout(dwellTimerRef.current);
            dwellTimerRef.current = null;
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (dwellTimerRef.current !== null) {
        clearTimeout(dwellTimerRef.current);
      }
    };
  }, [group.latestBuild.buildId]);

  const latestEntry = buildRowToEntry(group.latestBuild);

  return (
    <Box ref={cardRef}>
      <Accordion.Item
        value={group.jobFullPath}
        {...onHover}
        style={{
          transition: 'background-color 0.15s, border-color 0.15s, transform 0.15s',
          backgroundColor: isHovered ? colors.surfaceHover : undefined,
          borderLeft: `3px solid ${colors.success}`,
          transform: isHovered ? 'translateX(2px)' : undefined,
          animation: 'fadeUp 0.3s ease both',
        }}
      >
        <Accordion.Control>
          <Stack gap={6} style={{ minWidth: 0 }}>
            <Group gap={10} wrap="nowrap">
              <Text size="md" fw={600} c={colors.text} truncate>
                {group.jobName}
              </Text>
              <Badge size="sm" variant="light" color="green">
                Fixed
              </Badge>
            </Group>
            <Text size="sm" c={colors.textTertiary}>
              Recovered after {group.streak} failure{group.streak !== 1 ? 's' : ''}
            </Text>
          </Stack>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <Group gap="lg">
              {latestEntry.classification && (
                <Badge
                  size="sm"
                  variant="light"
                  color={latestEntry.classification === 'infrastructure' ? 'red' : 'orange'}
                >
                  {latestEntry.classification === 'infrastructure' ? 'Infrastructure' : 'Code'}
                </Badge>
              )}
              {latestEntry.triggeredBy && (
                <Text size="sm" c={colors.textTertiary}>
                  Triggered by {String(latestEntry.triggeredBy)}
                </Text>
              )}
            </Group>
            <FailureDetail f={latestEntry} />
            {group.failureBuilds.length > 1 && (
              <>
                <Divider color={colors.surfaceLight} />
                <Stack gap="xs">
                  <Text size="sm" c={colors.textSecondary} fw={500}>
                    {group.failureBuilds.length - 1} earlier{' '}
                    {group.failureBuilds.length > 2 ? 'builds' : 'build'} also failed
                  </Text>
                  {group.failureBuilds.slice(1).map((b) => (
                    <Group key={b.buildId} gap="sm">
                      <Text size="sm" c={colors.textSecondary} fw={500}>
                        #{b.buildNumber}
                      </Text>
                      <Text size="sm" c={colors.textTertiary}>
                        {new Date(b.startedAt).toLocaleString()}
                      </Text>
                      {b.aiSummary && (
                        <Text
                          size="sm"
                          c={colors.textSecondary}
                          lineClamp={1}
                          style={{ flex: 1 }}
                        >
                          {b.aiSummary}
                        </Text>
                      )}
                    </Group>
                  ))}
                </Stack>
              </>
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Box>
  );
}
