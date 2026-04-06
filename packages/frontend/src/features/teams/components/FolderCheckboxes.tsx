import { Stack, Text, Group, Checkbox } from "@mantine/core";
import { colors } from "../../../theme/mantine-theme";
import type { FolderNode } from "./folder-tree";

interface FolderCheckboxesProps {
  readonly nodes: FolderNode[];
  readonly selected: Set<string>;
  readonly onToggle: (path: string) => void;
  readonly depth: number;
}

const cbxStyles = {
  input: { backgroundColor: colors.surfaceLight, borderColor: colors.border },
};

export function FolderCheckboxes({
  nodes,
  selected,
  onToggle,
  depth,
}: FolderCheckboxesProps) {
  return (
    <Stack gap={2} pl={depth * 16}>
      {nodes.map((node) => {
        const pattern = node.path + "/**";
        const isChecked = selected.has(pattern);
        const hasChildChecked = node.children.some((c) =>
          selected.has(c.path + "/**"),
        );
        return (
          <div key={node.path}>
            <Checkbox
              size="xs"
              label={
                <Group gap={6}>
                  <Text size="xs" c={isChecked ? colors.text : colors.textSecondary}>
                    {node.name}
                  </Text>
                  <Text size="xs" c={colors.textMuted}>
                    {node.jobCount}
                  </Text>
                </Group>
              }
              checked={isChecked}
              indeterminate={!isChecked && hasChildChecked}
              onChange={() => onToggle(pattern)}
              styles={cbxStyles}
            />
            {node.children.length > 0 && (
              <FolderCheckboxes
                nodes={node.children}
                selected={selected}
                onToggle={onToggle}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </Stack>
  );
}
