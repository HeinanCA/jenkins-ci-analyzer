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
    <Stack gap="md">
      {aiRootCause && (
        <Code block style={{ ...codeStyle, fontSize: 13, padding: 14 }}>
          {aiRootCause}
        </Code>
      )}

      {aiFixes?.failingTest && (
        <Text size="sm" c={colors.textTertiary}>
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
        <Text size="sm" c={colors.textTertiary}>
          Assertion:{" "}
          <Text span c={colors.textSecondary}>
            {String(aiFixes.assertion)}
          </Text>
        </Text>
      )}

      {fixes.length > 0 && (
        <Stack gap="sm">
          <Text size="sm" fw={600} c={colors.textSecondary}>
            Suggested fix
          </Text>
          {firstFix && (
            <Group gap="sm">
              <Code
                style={{ ...codeStyle, fontSize: 12, flex: 1, padding: 10 }}
              >
                {firstFix}
              </Code>
              <CopyButton value={firstFix}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy command"}>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color={copied ? "green" : "gray"}
                      onClick={copy}
                    >
                      <Text size="sm">{copied ? "✓" : "⎘"}</Text>
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          )}
          {fixes.length > 1 && (
            <List
              size="sm"
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
        <Stack gap="sm">
          <Text size="sm" c={colors.textSecondary}>
            {String(primary.description ?? "")}
          </Text>
          {primary.matchedLine && (
            <Code block style={{ ...codeStyle, fontSize: 12 }}>
              {String(primary.matchedLine)}
            </Code>
          )}
        </Stack>
      )}

      <Group gap="md" justify="space-between" mt={4}>
        <Group gap="lg">
          {noisePercent && noisePercent >= 30 && (
            <Text
              size="sm"
              c={colors.textMuted}
              style={{ fontStyle: "italic" }}
            >
              {noisePercent}% log noise{topNoise ? ` — ${topNoise}` : ""}
            </Text>
          )}
          {jobUrl && (
            <Anchor
              href={`${jobUrl}${f.buildNumber}/console`}
              target="_blank"
              size="sm"
              c={colors.textMuted}
            >
              View in Jenkins
            </Anchor>
          )}
        </Group>
        {hasAi && f.analysisId && <FeedbackButtons analysisId={f.analysisId} />}
      </Group>
    </Stack>
  );
}
