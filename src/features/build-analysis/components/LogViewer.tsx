import { Code, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { useMemo, useState } from 'react';

interface Props {
  readonly log: string;
  readonly highlightLine?: number;
}

export function LogViewer({ log, highlightLine }: Props) {
  const [search, setSearch] = useState('');

  const lines = useMemo(() => log.split('\n'), [log]);

  const filteredLines = useMemo(() => {
    if (!search) return lines;
    const lower = search.toLowerCase();
    return lines.filter((line) => line.toLowerCase().includes(lower));
  }, [lines, search]);

  return (
    <Stack gap="xs">
      <TextInput
        placeholder="Search log..."
        size="xs"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
      <Text size="xs" c="dimmed">
        {search
          ? `${filteredLines.length} matching lines`
          : `${lines.length} total lines`}
      </Text>
      <ScrollArea h={400} type="auto">
        <Code block style={{ fontSize: '12px', lineHeight: '1.5' }}>
          {filteredLines.map((line, idx) => {
            const lineNum = search ? idx + 1 : idx + 1;
            const isHighlighted =
              !search && highlightLine !== undefined && idx + 1 === highlightLine;
            return (
              <div
                key={idx}
                style={{
                  backgroundColor: isHighlighted
                    ? 'rgba(255, 0, 0, 0.15)'
                    : undefined,
                  padding: '0 4px',
                }}
              >
                <span style={{ color: '#666', marginRight: 8, userSelect: 'none' }}>
                  {String(lineNum).padStart(5)}
                </span>
                {line}
              </div>
            );
          })}
        </Code>
      </ScrollArea>
    </Stack>
  );
}
