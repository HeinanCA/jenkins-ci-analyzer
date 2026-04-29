import {
  Accordion,
  Badge,
  Box,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { colors } from '../../../theme/mantine-theme';
import { FailureDetail } from './FailureDetail';
import { PriorityBadge } from './PriorityBadge';
import { PRIORITY_DISPLAY } from '../constants/priority-display';
import type { JobFailureGroup, FailureEntry } from '../types';
import styles from './BrokenJobCard.module.css';

interface BrokenJobCardProps {
  readonly group: JobFailureGroup;
  readonly isHovered: boolean;
  readonly onHover: {
    readonly onMouseEnter: () => void;
    readonly onMouseLeave: () => void;
  };
}

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
    priority: b.priority,
  };
}

export function BrokenJobCard({ group, isHovered, onHover }: BrokenJobCardProps) {
  const f = buildRowToEntry(group.latestBuild);
  const aiRootCause = f.aiRootCause as string | undefined;
  const aiSummary = f.aiSummary as string | undefined;
  const aiDisplay = aiRootCause || aiSummary;
  const hasAi = !!aiSummary || !!aiRootCause;
  const isInProgress = group.status === 'in_progress';
  const isMobile = useMediaQuery('(max-width: 575px)', false);

  // Priority-tinted left border; in_progress keeps ember accent
  // Read from latestBuild (typed BuildRow) not FailureEntry (index signature)
  const priority = group.latestBuild.priority ?? 'UNKNOWN';
  const borderLeftColor = isInProgress
    ? colors.accent
    : (PRIORITY_DISPLAY[priority]?.border ?? colors.border);

  return (
    <Accordion.Item
      value={group.jobFullPath}
      {...onHover}
      style={{
        transition: 'background-color 0.15s, border-color 0.15s, transform 0.15s',
        backgroundColor: isHovered ? colors.surfaceHover : undefined,
        borderLeft: `3px solid ${borderLeftColor}`,
        transform: isHovered ? 'translateX(2px)' : undefined,
        animation: 'fadeUp 0.3s ease both',
      }}
    >
      <Accordion.Control>
        <Stack gap={6} style={{ minWidth: 0 }}>
          <Group gap={10} wrap="nowrap">
            {!isInProgress && (
              <PriorityBadge
                priority={priority}
                size={isMobile ? 'xs' : 'sm'}
                showLabel={!isMobile}
              />
            )}
            <Text size="md" fw={600} c={colors.text} truncate>
              {group.jobName}
            </Text>
            {group.streak > 1 && !isInProgress && (
              <Group gap={3} style={{ flexShrink: 0 }}>
                {Array.from({ length: Math.min(group.streak, 7) }, (_, i) => (
                  <Box
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: colors.failure,
                      opacity: 0.4 + (i / Math.min(group.streak, 7)) * 0.6,
                    }}
                  />
                ))}
                <Text
                  size="xs"
                  fw={600}
                  c={colors.failure}
                  style={{ fontFamily: 'ui-monospace, monospace', marginLeft: 2 }}
                >
                  {group.streak}x
                </Text>
              </Group>
            )}
          </Group>

          {isInProgress ? (
            <Group gap={6}>
              <Loader size={12} color={colors.accent} />
              <Text
                size="sm"
                c={colors.textSecondary}
                className={styles.runningPulse}
              >
                Build #{group.latestBuild.buildNumber} running…
              </Text>
            </Group>
          ) : hasAi ? (
            <Text size="sm" c={colors.textSecondary} lineClamp={1}>
              {aiDisplay}
            </Text>
          ) : (
            <Group gap={6}>
              <Loader size={12} color={colors.textMuted} />
              <Text size="sm" c={colors.textMuted}>
                Analyzing...
              </Text>
            </Group>
          )}
        </Stack>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="md">
          <Group gap="lg">
            <PriorityBadge priority={priority} size="sm" />
            {f.classification && (
              <Badge
                size="sm"
                variant="light"
                color={f.classification === 'infrastructure' ? 'red' : 'orange'}
              >
                {f.classification === 'infrastructure' ? 'Infrastructure' : 'Code'}
              </Badge>
            )}
            {f.triggeredBy && (
              <Text size="sm" c={colors.textTertiary}>
                Triggered by {String(f.triggeredBy)}
              </Text>
            )}
          </Group>

          <FailureDetail f={f} />

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
  );
}
