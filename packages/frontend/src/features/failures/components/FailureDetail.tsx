import {
  Stack,
  Text,
  Code,
  Group,
  List,
  Anchor,
  ActionIcon,
  Tooltip,
  CopyButton,
} from "@mantine/core";
import { colors, codeStyle } from "../../../theme/mantine-theme";
import { SourceLink } from "./SourceLink";
import { FeedbackButtons } from "./FeedbackButtons";
import type { FailureEntry } from "../types";

interface Props {
  readonly f: FailureEntry;
}

export function FailureDetail({ f }: Props) {
  const aiRootCause = f.aiRootCause as string | undefined;
  const aiFixes = f.aiSuggestedFixes as Record<string, unknown> | undefined;
  const jobUrl = f.jobUrl as string | undefined;
  const hasAi = !!(f.aiSummary as string | undefined);
  const fixes = Array.isArray(aiFixes?.fixes)
    ? (aiFixes.fixes as string[])
    : [];
  const firstFix = fixes[0];
  const matches = Array.isArray(f.matches)
    ? (f.matches as Record<string, unknown>[])
    : [];
  const primary = matches[0];
  const noisePercent = f.logNoisePercent as number | undefined;
  const topNoise = f.logTopNoise as string | undefined;
  const filePath = aiFixes?.filePath as string | undefined;
  const lineNumber = aiFixes?.lineNumber as number | undefined;

  return (
    <Stack gap="sm">
      {aiRootCause && (
        <Code block style={codeStyle}>
          {aiRootCause}
        </Code>
      )}

      {aiFixes?.failingTest && (
        <Text size="xs" c={colors.textTertiary}>
          Test:{" "}
          <Text span c={colors.textSecondary} fw={500}>
            {String(aiFixes.failingTest)}
          </Text>
        </Text>
      )}

      {filePath && (
        <SourceLink
          filePath={filePath}
          lineNumber={lineNumber}
          gitRemoteUrl={f.gitRemoteUrl as string | undefined}
          gitSha={f.gitSha as string | undefined}
        />
      )}

      {aiFixes?.assertion && (
        <Text size="xs" c={colors.textTertiary}>
          Assertion:{" "}
          <Text span c={colors.textSecondary}>
            {String(aiFixes.assertion)}
          </Text>
        </Text>
      )}

      {fixes.length > 0 && (
        <Stack gap="xs">
          <Text size="xs" fw={600} c={colors.textSecondary}>
            Fix:
          </Text>
          {firstFix && (
            <Group gap="xs">
              <Code style={{ ...codeStyle, fontSize: 11, flex: 1 }}>
                {firstFix}
              </Code>
              <CopyButton value={firstFix}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy command"}>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color={copied ? "green" : "gray"}
                      onClick={copy}
                    >
                      <Text size="xs">{copied ? "✓" : "⎘"}</Text>
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          )}
          {fixes.length > 1 && (
            <List
              size="xs"
              type="ordered"
              styles={{ item: { color: colors.textTertiary } }}
            >
              {fixes.slice(1).map((step, i) => (
                <List.Item key={i}>{step}</List.Item>
              ))}
            </List>
          )}
        </Stack>
      )}

      {!hasAi && primary && (
        <Stack gap="xs">
          <Text size="xs" c={colors.textSecondary}>
            {String(primary.description ?? "")}
          </Text>
          {primary.matchedLine && (
            <Code block style={{ ...codeStyle, fontSize: 11 }}>
              {String(primary.matchedLine)}
            </Code>
          )}
        </Stack>
      )}

      <Group gap="md" justify="space-between">
        <Group gap="md">
          {noisePercent && noisePercent >= 30 && (
            <Text
              size="xs"
              c={colors.textMuted}
              style={{ fontStyle: "italic" }}
            >
              💡 {noisePercent}% noise{topNoise ? ` (${topNoise})` : ""}
            </Text>
          )}
          {jobUrl && (
            <Anchor
              href={`${jobUrl}${f.buildNumber}/console`}
              target="_blank"
              size="xs"
              c={colors.textMuted}
            >
              Jenkins ↗
            </Anchor>
          )}
        </Group>
        {hasAi && f.analysisId && <FeedbackButtons analysisId={f.analysisId} />}
      </Group>
    </Stack>
  );
}
