// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDismissalQueue } from '../../src/features/failures/hooks/use-dismissal-queue';

// ─── IntersectionObserver mock ────────────────────────────────
class MockIntersectionObserver {
  readonly callback: IntersectionObserverCallback;
  static instances: MockIntersectionObserver[] = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  triggerIntersect(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useDismissalQueue', () => {
  it('calls onDismissed with enqueued ids after debounce', async () => {
    const onDismissed = vi.fn();
    const { result } = renderHook(() => useDismissalQueue(onDismissed));

    act(() => {
      result.current.enqueue('build-1');
      result.current.enqueue('build-2');
    });

    expect(onDismissed).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onDismissed).toHaveBeenCalledOnce();
    expect(onDismissed).toHaveBeenCalledWith(['build-1', 'build-2']);
  });

  it('fires immediately when batch reaches 10 ids', () => {
    const onDismissed = vi.fn();
    const { result } = renderHook(() => useDismissalQueue(onDismissed));

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.enqueue(`build-${i}`);
      }
    });

    expect(onDismissed).toHaveBeenCalledOnce();
  });

  it('deduplicates ids — same id enqueued twice only fires once', () => {
    const onDismissed = vi.fn();
    const { result } = renderHook(() => useDismissalQueue(onDismissed));

    act(() => {
      result.current.enqueue('build-dup');
      result.current.enqueue('build-dup');
      vi.advanceTimersByTime(3000);
    });

    expect(onDismissed).toHaveBeenCalledWith(['build-dup']);
  });

  it('flush() drains queue immediately without waiting for debounce', () => {
    const onDismissed = vi.fn();
    const { result } = renderHook(() => useDismissalQueue(onDismissed));

    act(() => {
      result.current.enqueue('build-a');
    });

    act(() => {
      result.current.flush();
    });

    expect(onDismissed).toHaveBeenCalledWith(['build-a']);
  });

  it('does not call onDismissed when queue is empty on flush', () => {
    const onDismissed = vi.fn();
    const { result } = renderHook(() => useDismissalQueue(onDismissed));

    act(() => {
      result.current.flush();
    });

    expect(onDismissed).not.toHaveBeenCalled();
  });

  it('flushes on unmount', () => {
    const onDismissed = vi.fn();
    const { result, unmount } = renderHook(() => useDismissalQueue(onDismissed));

    act(() => {
      result.current.enqueue('build-unmount');
    });

    expect(onDismissed).not.toHaveBeenCalled();

    unmount();

    expect(onDismissed).toHaveBeenCalledWith(['build-unmount']);
  });

  it('debounce timer resets on each enqueue', () => {
    const onDismissed = vi.fn();
    const { result } = renderHook(() => useDismissalQueue(onDismissed));

    act(() => {
      result.current.enqueue('build-x');
      vi.advanceTimersByTime(2000);
      result.current.enqueue('build-y'); // resets the 3s timer
      vi.advanceTimersByTime(2000); // total 4s but only 2s since last enqueue
    });

    expect(onDismissed).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1100); // now past 3s since last enqueue
    });

    expect(onDismissed).toHaveBeenCalledWith(['build-x', 'build-y']);
  });
});
