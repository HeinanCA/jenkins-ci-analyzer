import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
import { colors, cardStyle } from "../../../theme/mantine-theme";

interface TeamCardProps {
  readonly team: {
    readonly id: string;
    readonly name: string;
    readonly folderPatterns: string[];
  };
  readonly onDelete: (id: string) => void;
}

export function TeamCard({ team, onDelete }: TeamCardProps) {
  return (
    <Card radius="md" style={cardStyle} p="sm">
      <Group justify="space-between">
        <Stack gap={2}>
          <Text size="sm" fw={500} c={colors.text}>
            {team.name}
          </Text>
          <Group gap={4}>
            {team.folderPatterns.map((p, i) => (
              <Badge key={i} size="xs" variant="light" color="orange">
                {p}
              </Badge>
            ))}
          </Group>
        </Stack>
        <Tooltip label="Delete team">
          <ActionIcon
            size="xs"
            variant="subtle"
            color="red"
            onClick={() => onDelete(team.id)}
          >
            <Text size="xs">✕</Text>
          </ActionIcon>
        </Tooltip>
      </Group>
    </Card>
  );
}
