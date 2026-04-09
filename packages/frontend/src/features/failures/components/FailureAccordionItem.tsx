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
import { colors, statusGradient } from "../../../theme/mantine-theme";
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
        transition: "background-color 0.15s ease",
        backgroundColor: isHovered ? colors.surfaceHover : undefined,
      }}
    >
      <Box
        style={{
          height: 3,
          borderRadius: "3px 3px 0 0",
          background: statusGradient(
            f.classification === "infrastructure"
              ? colors.failure
              : colors.accent,
          ),
        }}
      />
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
              <Badge
                size="sm"
                variant="light"
                color="red"
                style={{ flexShrink: 0 }}
              >
                {group.streak}x
              </Badge>
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
