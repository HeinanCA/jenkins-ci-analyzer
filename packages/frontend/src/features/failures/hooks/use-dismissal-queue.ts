import { useCallback, useEffect, useRef } from 'react';
import { tigDashboard } from '../../../api/tig-client';

const BATCH_SIZE = 10;
const DEBOUNCE_MS = 3000;

export interface DismissalQueueActions {
  readonly enqueue: (buildId: string) => void;
  readonly flush: () => void;
}

/**
 * Accumulates buildIds to dismiss and fires POST /failures/views when:
 *   (a) batch reaches BATCH_SIZE
 *   (b) debounce timer fires DEBOUNCE_MS after last enqueue
 *   (c) flush() is called explicitly (page unmount)
 *
 * onDismissed is called with the dismissed buildIds so the caller can
 * remove them from local state optimistically.
 */
export function useDismissalQueue(
  onDismissed: (buildIds: readonly string[]) => void,
): DismissalQueueActions {
  const queueRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissedRef = useRef(onDismissed);
  onDismissedRef.current = onDismissed;

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const ids = queueRef.current;
    if (ids.length === 0) return;
    // Snapshot and clear immediately (immutable: don't mutate the ref array)
    queueRef.current = [];
    const snapshot = [...ids];
    onDismissedRef.current(snapshot);
    tigDashboard.dismissFailures(snapshot).catch(() => {
      // Best-effort: silently ignore network failures for dismissal
    });
  }, []);

  const enqueue = useCallback(
    (buildId: string) => {
      // Deduplicate
      if (queueRef.current.includes(buildId)) return;
      queueRef.current = [...queueRef.current, buildId];

      if (queueRef.current.length >= BATCH_SIZE) {
        flush();
        return;
      }

      // Reset debounce timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    },
    [flush],
  );

  // Flush on unmount
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  return { enqueue, flush };
}
