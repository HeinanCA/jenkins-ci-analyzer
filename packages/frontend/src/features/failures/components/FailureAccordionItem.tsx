import {
  Accordion,
  Badge,
  Box,
  Divider,
  Group,
  Stack,
  Text,
  Tooltip,
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
  const aiSummary = f.aiSummary as string | undefined;
  const hasAi = !!aiSummary;

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
        <Group
          justify="space-between"
          wrap="nowrap"
          style={{ width: "100%", paddingRight: 8 }}
        >
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs">
              <Text size="sm" fw={500} c={colors.text} truncate>
                {group.jobName}
              </Text>
              {group.streak > 1 && (
                <Badge size="xs" variant="filled" color="red">
                  {group.streak}x failed
                </Badge>
              )}
            </Group>
            {f.triggeredBy && (
              <Text size="xs" c={colors.textTertiary}>
                Triggered by {String(f.triggeredBy)}
              </Text>
            )}
            {hasAi && (
              <Text size="xs" c={colors.textSecondary} lineClamp={1}>
                {aiSummary}
              </Text>
            )}
          </Stack>
          <Group gap={4}>
            {f.classification && (
              <Badge
                size="xs"
                variant="light"
                color={
                  f.classification === "infrastructure" ? "red" : "orange"
                }
              >
                {f.classification === "infrastructure" ? "Infra" : "Code"}
              </Badge>
            )}
            {hasAi ? (
              <Badge size="xs" variant="light" color="orange">
                AI
              </Badge>
            ) : (
              <Tooltip
                label="AI was offline. Classification may be inaccurate."
                multiline
                w={250}
              >
                <Badge size="xs" variant="light" color="gray">
                  regex
                </Badge>
              </Tooltip>
            )}
          </Group>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="md">
          <FailureDetail f={f} />
          {group.builds.length > 1 && (
            <>
              <Divider color={colors.surfaceLight} />
              <Stack gap="xs">
                <Text size="xs" c={colors.textMuted} fw={500}>
                  Also failed: {group.builds.length - 1} earlier build
                  {group.builds.length > 2 ? "s" : ""}
                </Text>
                {group.builds.slice(1).map((older) => (
                  <Group key={older.buildId} gap="xs">
                    <Text size="xs" c={colors.textTertiary}>
                      #{older.buildNumber}
                    </Text>
                    <Text size="xs" c={colors.textMuted}>
                      {new Date(older.startedAt).toLocaleString()}
                    </Text>
                    {(older.aiSummary as string | undefined) && (
                      <Text
                        size="xs"
                        c={colors.textMuted}
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
