// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFailuresScope } from "../../src/features/failures/hooks/use-failures-scope";

const KEY = "pulsci_failures_scope";

// Minimal localStorage mock
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => {
    store[k] = v;
  }),
  removeItem: vi.fn((k: string) => {
    delete store[k];
  }),
  clear: vi.fn(() => {
    for (const k in store) delete store[k];
  }),
};

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal("localStorage", localStorageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useFailuresScope", () => {
  it('defaults to "mine" when localStorage has no value', () => {
    const { result } = renderHook(() => useFailuresScope());
    expect(result.current[0]).toBe("mine");
  });

  it("reads stored value from localStorage on mount", () => {
    localStorage.setItem(KEY, "all");
    const { result } = renderHook(() => useFailuresScope());
    expect(result.current[0]).toBe("all");
  });

  it('defaults to "mine" when localStorage has invalid value', () => {
    localStorage.setItem(KEY, "invalid-value");
    const { result } = renderHook(() => useFailuresScope());
    expect(result.current[0]).toBe("mine");
  });

  it("persists scope to localStorage when changed", () => {
    const { result } = renderHook(() => useFailuresScope());

    act(() => {
      result.current[1]("all");
    });

    expect(result.current[0]).toBe("all");
    expect(localStorage.getItem(KEY)).toBe("all");
  });

  it('persists back to "mine" when toggled back', () => {
    localStorage.setItem(KEY, "all");
    const { result } = renderHook(() => useFailuresScope());

    act(() => {
      result.current[1]("mine");
    });

    expect(result.current[0]).toBe("mine");
    expect(localStorage.getItem(KEY)).toBe("mine");
  });

  it("new hook instance reads the updated localStorage value", () => {
    const { result: a } = renderHook(() => useFailuresScope());

    act(() => {
      a.current[1]("all");
    });

    const { result: b } = renderHook(() => useFailuresScope());
    expect(b.current[0]).toBe("all");
  });
});
