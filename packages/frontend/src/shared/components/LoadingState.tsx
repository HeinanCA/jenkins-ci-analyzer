import { Stack, Loader } from "@mantine/core";

/**
 * Replaces the 12 copy-pasted loading spinners across pages.
 */
export function LoadingState() {
  return (
    <Stack align="center" py="xl">
      <Loader color="orange" size="sm" />
    </Stack>
  );
}
