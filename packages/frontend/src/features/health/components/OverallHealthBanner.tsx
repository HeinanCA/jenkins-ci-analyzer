import { Alert, Text, List } from "@mantine/core";
import type { HealthReport } from "@tig/shared";

interface Props {
  readonly report: HealthReport;
}

const LEVEL_CONFIG = {
  healthy: { color: "green", title: "Jenkins is healthy" },
  degraded: { color: "yellow", title: "Jenkins is degraded" },
  unhealthy: { color: "red", title: "Jenkins is unhealthy" },
  down: { color: "red", title: "Jenkins is DOWN" },
} as const;

export function OverallHealthBanner({ report }: Props) {
  const config = LEVEL_CONFIG[report.level];

  return (
    <Alert color={config.color} title={config.title}>
      {report.issues.length > 0 ? (
        <List size="sm">
          {report.issues.map((issue, idx) => (
            <List.Item key={idx}>{issue}</List.Item>
          ))}
        </List>
      ) : (
        <Text size="sm">
          All systems operational. Score: {report.score}/100
        </Text>
      )}
    </Alert>
  );
}
