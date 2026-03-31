import { Group, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { colors } from "../../theme/mantine-theme";

interface PageHeaderProps {
  readonly title: string;
  readonly leftContent?: ReactNode;
  readonly children?: ReactNode;
}

/**
 * Consistent page header: title left, filters/controls right.
 * Optional leftContent renders inline next to the title (e.g. team selector).
 */
export function PageHeader({ title, leftContent, children }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="center">
      <Group gap="sm">
        <Title order={3} c={colors.text}>
          {title}
        </Title>
        {leftContent}
      </Group>
      {children && <Group gap="sm">{children}</Group>}
    </Group>
  );
}
