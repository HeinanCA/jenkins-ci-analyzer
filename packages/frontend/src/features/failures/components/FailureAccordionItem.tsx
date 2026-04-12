import {
  Accordion,
  Badge,
  Box,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { colors } from "../../../theme/mantine-theme";
import { FailureDetail } from "./FailureDetail";
import type { GroupedFailure } from "../types";

interface FailureAccordionItemProps {
  readonly group: GroupedFailure;
  readonly isHovered: boolean;
  readonly onHover: {
    readonly onMouseEnter: () => void;
    readonly onMouseLeave: () => void;
  };
}

export function FailureAccordionItem({
  group,
  isHovered,
  onHover,
}: FailureAccordionItemProps) {
  const f = group.latest;
  const aiRootCause = f.aiRootCause as string | undefined;
  const aiSummary = f.aiSummary as string | undefined;
  const aiDisplay = aiRootCause || aiSummary;
  const hasAi = !!aiSummary || !!aiRootCause;

  return (
    <Accordion.Item
      value={group.jobFullPath}
      {...onHover}
      style={{
        transition:
          "background-color 0.15s, border-color 0.15s, transform 0.15s",
        backgroundColor: isHovered ? colors.surfaceHover : undefined,
        borderLeft: `3px solid ${f.classification === "infrastructure" ? colors.failure : colors.accent}`,
        transform: isHovered ? "translateX(2px)" : undefined,
        animation: "fadeUp 0.3s ease both",
      }}
    >
      <Accordion.Control>
        {/* Collapsed state: just the job name + one-line root cause.
            Everything else (streak, triggered by, classification) lives
            in the expanded detail. Keep it scannable. */}
        <Stack gap={6} style={{ minWidth: 0 }}>
          <Group gap={10} wrap="nowrap">
            <Text size="md" fw={600} c={colors.text} truncate>
              {group.jobName}
            </Text>
            {group.streak > 1 && (
              <Group gap={3} style={{ flexShrink: 0 }}>
                {Array.from({ length: Math.min(group.streak, 7) }, (_, i) => (
                  <Box
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: colors.failure,
                      opacity: 0.4 + (i / Math.min(group.streak, 7)) * 0.6,
                    }}
                  />
                ))}
                <Text
                  size="xs"
                  fw={600}
                  c={colors.failure}
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    marginLeft: 2,
                  }}
                >
                  {group.streak}x
                </Text>
              </Group>
            )}
          </Group>

          {hasAi ? (
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
          {/* Secondary info that was previously crammed into the header */}
          <Group gap="lg">
            {f.classification && (
              <Badge
                size="sm"
                variant="light"
                color={f.classification === "infrastructure" ? "red" : "orange"}
              >
                {f.classification === "infrastructure"
                  ? "Infrastructure"
                  : "Code"}
              </Badge>
            )}
            {f.triggeredBy && (
              <Text size="sm" c={colors.textTertiary}>
                Triggered by {String(f.triggeredBy)}
              </Text>
            )}
          </Group>

          <FailureDetail f={f} />

          {group.builds.length > 1 && (
            <>
              <Divider color={colors.surfaceLight} />
              <Stack gap="xs">
                <Text size="sm" c={colors.textSecondary} fw={500}>
                  {group.builds.length - 1} earlier{" "}
                  {group.builds.length > 2 ? "builds" : "build"} also failed
                </Text>
                {group.builds.slice(1).map((older) => (
                  <Group key={older.buildId} gap="sm">
                    <Text size="sm" c={colors.textSecondary} fw={500}>
                      #{older.buildNumber}
                    </Text>
                    <Text size="sm" c={colors.textTertiary}>
                      {new Date(older.startedAt).toLocaleString()}
                    </Text>
                    {(older.aiSummary as string | undefined) && (
                      <Text
                        size="sm"
                        c={colors.textSecondary}
                        lineClamp={1}
                        style={{ flex: 1 }}
                      >
                        {String(older.aiSummary)}
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
