import { useState, useMemo } from "react";
import {
  Text,
  Card,
  Group,
  TextInput,
  Badge,
  ActionIcon,
  ScrollArea,
} from "@mantine/core";
import { colors } from "../../../theme/mantine-theme";
import { buildFolderTree, filterTree } from "./folder-tree";
import { FolderCheckboxes } from "./FolderCheckboxes";

interface FolderPickerProps {
  readonly jobs: { fullPath: string }[];
  readonly selected: Set<string>;
  readonly onToggle: (pattern: string) => void;
}

const inputStyles = {
  input: { backgroundColor: colors.surfaceLight, border: "none" },
};

export function FolderPicker({ jobs, selected, onToggle }: FolderPickerProps) {
  const [search, setSearch] = useState("");
  const folderTree = useMemo(() => buildFolderTree(jobs), [jobs]);
  const filteredTree = useMemo(
    () => filterTree(folderTree, search),
    [folderTree, search],
  );

  return (
    <>
      <TextInput
        placeholder="Search folders..."
        size="xs"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        styles={inputStyles}
      />
      <ScrollArea h={280} type="auto">
        <Card radius="md" p="sm" style={{ backgroundColor: colors.surfaceLight }}>
          {filteredTree.length > 0 ? (
            <FolderCheckboxes
              nodes={filteredTree}
              selected={selected}
              onToggle={onToggle}
              depth={0}
            />
          ) : (
            <Text size="xs" c={colors.textMuted}>
              {search ? "No matching folders" : "Loading..."}
            </Text>
          )}
        </Card>
      </ScrollArea>
      {selected.size > 0 && (
        <Group gap={4}>
          {Array.from(selected).map((p) => (
            <Badge
              key={p}
              size="xs"
              variant="light"
              color="orange"
              rightSection={
                <ActionIcon size={12} variant="transparent" onClick={() => onToggle(p)}>
                  <Text size="xs" c={colors.textMuted}>
                    ✕
                  </Text>
                </ActionIcon>
              }
            >
              {p}
            </Badge>
          ))}
        </Group>
      )}
    </>
  );
}
