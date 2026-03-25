import { Alert, Button, Group } from "@mantine/core";
import { colors } from "../../theme/mantine-theme";

export function QueryError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Alert color="red" variant="light" title="Something went wrong" styles={{ root: { backgroundColor: colors.surface, border: `1px solid ${colors.border}` } }}>
      <Group justify="space-between" align="center">
        {message || "Failed to load data. Please try again."}
        {onRetry && <Button size="xs" variant="light" color="orange" onClick={onRetry}>Retry</Button>}
      </Group>
    </Alert>
  );
}
