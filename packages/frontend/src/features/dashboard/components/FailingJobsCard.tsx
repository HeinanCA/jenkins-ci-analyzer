import { useNavigate } from "react-router-dom";
import { Stack, Card, Text, Group, Badge, Box } from "@mantine/core";
import {
  colors,
  cardStyle,
  cardHoverStyle,
  statusGradient,
} from "../../../theme/mantine-theme";
import { useHover } from "../../../shared/hooks/use-hover";
import type { GroupedFailure } from "../../failures/types";

interface FailingJobsCardProps {
  readonly data: readonly GroupedFailure[];
}

export function FailingJobsCard({ data }: FailingJobsCardProps) {
  const navigate = useNavigate();
  const { hovered, bind } = useHover<string>();

  if (data.length === 0) {
    return null;
  }

  return (
    <Stack gap="sm">
      <Text size="sm" fw={600} c={colors.textSecondary}>
        Failing jobs
      </Text>
      {data.map((g) => {
        const aiSummary = g.latest.aiSummary as string | undefined;
        const isInfra = g.latest.classification === "infrastructure";
        const barColor = isInfra ? colors.failure : colors.warning;
        const isHovered = hovered === g.jobFullPath;

        return (
          <Card
            key={g.jobFullPath}
            radius="md"
            style={{
              ...(isHovered ? cardHoverStyle : cardStyle),
              overflow: "hidden",
              position: "relative",
              cursor: "pointer",
            }}
            p={0}
            onClick={() => navigate("/failures")}
            {...bind(g.jobFullPath)}
          >
            <Box
              style={{
                height: 3,
                background: statusGradient(barColor),
              }}
            />
            <Box p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs">
                    <Text size="sm" fw={500} c={colors.text} truncate>
                      {g.jobName}
                    </Text>
                    {g.streak > 1 && (
                      <Badge size="xs" variant="filled" color="red">
                        {g.streak}x
                      </Badge>
                    )}
                  </Group>
                  {aiSummary && (
                    <Text size="xs" c={colors.textSecondary} lineClamp={1}>
                      {aiSummary}
                    </Text>
                  )}
                </Stack>
                {g.latest.classification && (
                  <Badge
                    size="xs"
                    variant="light"
                    color={isInfra ? "red" : "orange"}
                  >
                    {isInfra ? "Infra" : "Code"}
                  </Badge>
                )}
              </Group>
            </Box>
          </Card>
        );
      })}
    </Stack>
  );
}
