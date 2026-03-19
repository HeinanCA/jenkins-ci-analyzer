import { Badge, Tooltip } from "@mantine/core";
import type { ClassificationResult } from "@tig/shared";

interface Props {
  readonly classification: ClassificationResult;
}

const BADGE_CONFIG = {
  infrastructure: {
    color: "red",
    label: "Infrastructure Issue",
    tooltip: "This is an infrastructure problem — not your code.",
  },
  code: {
    color: "orange",
    label: "Code Issue",
    tooltip: "This is a code-level issue you can fix.",
  },
  unknown: {
    color: "gray",
    label: "Unknown",
    tooltip: "Could not determine the failure category.",
  },
} as const;

export function InfraCodeBadge({ classification }: Props) {
  const config = BADGE_CONFIG[classification.classification];
  const confidencePercent = Math.round(classification.confidence * 100);

  return (
    <Tooltip
      label={`${config.tooltip} (${confidencePercent}% confidence)`}
      multiline
      w={250}
    >
      <Badge color={config.color} variant="filled" size="lg">
        {config.label}
      </Badge>
    </Tooltip>
  );
}
