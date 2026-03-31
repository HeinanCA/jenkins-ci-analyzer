import { useState, useCallback } from "react";

/**
 * Reusable hover state — replaces 8 separate useState + handlers.
 */
export function useHover<T = string>() {
  const [hovered, setHovered] = useState<T | null>(null);

  const bind = useCallback(
    (id: T) => ({
      onMouseEnter: () => setHovered(id),
      onMouseLeave: () => setHovered(null),
    }),
    [],
  );

  return { hovered, bind } as const;
}
