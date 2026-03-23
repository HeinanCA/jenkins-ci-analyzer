import { Group, Text, Anchor } from '@mantine/core';
import { colors } from '../../../theme/mantine-theme';

interface Props {
  readonly filePath: string;
  readonly lineNumber?: number;
  readonly gitRemoteUrl?: string;
  readonly gitSha?: string;
}

export function SourceLink({ filePath, lineNumber, gitRemoteUrl, gitSha }: Props) {
  const repoUrl = gitRemoteUrl?.replace(/\.git$/, '');
  const sourceUrl =
    repoUrl && gitSha
      ? `${repoUrl}/blob/${gitSha}/${filePath}${lineNumber ? `#L${lineNumber}` : ''}`
      : null;

  return (
    <Group gap="xs">
      <Text size="xs" c={colors.textTertiary}>
        File:{' '}
        <Text span c={colors.textSecondary}>
          {filePath}
          {lineNumber ? `:${lineNumber}` : ''}
        </Text>
      </Text>
      {sourceUrl && (
        <Anchor href={sourceUrl} target="_blank" size="xs" c={colors.accent}>
          View source ↗
        </Anchor>
      )}
    </Group>
  );
}
