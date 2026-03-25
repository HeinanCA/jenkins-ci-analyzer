import { describe, it, expect } from "vitest";
import { extractErrorContext } from "../src/services/log-extract";

describe("extractErrorContext", () => {
  it("returns unchanged text for small logs (<500 lines)", () => {
    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i}`);
    const log = lines.join("\n");
    const result = extractErrorContext(log);
    expect(result.text).toBe(log);
    expect(result.stats.extracted).toBe(false);
  });

  it("keeps lines around ERROR markers with context window", () => {
    const lines = [
      ...Array.from({ length: 100 }, (_, i) => `[INFO] Compiling module-${i}`),
      "[INFO] context before error A",
      "[INFO] context before error B",
      "[ERROR] NullPointerException in UserService.java:42",
      "[INFO] context after error",
      ...Array.from({ length: 400 }, (_, i) => `[INFO] Downloading dep-${i}`),
      "[INFO] Build complete",
    ];
    const log = lines.join("\n");
    const result = extractErrorContext(log);

    expect(result.text).toContain("NullPointerException");
    expect(result.text).toContain("context before error A");
    expect(result.text).toContain("context before error B");
    expect(result.text).toContain("context after error");
    // Most download lines should be gone
    expect(result.stats.outputLines).toBeLessThan(lines.length / 2);
  });

  it("keeps lines around FAIL markers", () => {
    const lines = [
      ...Array.from({ length: 300 }, (_, i) => `[INFO] Test ${i} passed`),
      "[INFO] Running FailingTest",
      "FAIL: expected 200 but got 500",
      "  at TestRunner.run(TestRunner.java:55)",
      ...Array.from({ length: 300 }, (_, i) => `[INFO] Cleanup ${i}`),
    ];
    const log = lines.join("\n");
    const result = extractErrorContext(log);

    expect(result.text).toContain("FAIL: expected 200 but got 500");
    expect(result.text).toContain("Running FailingTest");
    expect(result.text).toContain("TestRunner.run");
  });

  it("keeps lines around Exception/Traceback markers", () => {
    const lines = [
      ...Array.from({ length: 300 }, (_, i) => `[INFO] Processing ${i}`),
      "java.lang.IllegalArgumentException: Invalid config",
      "  at com.example.App.main(App.java:12)",
      "  at org.junit.Runner.run(Runner.java:100)",
      ...Array.from({ length: 300 }, (_, i) => `[INFO] More output ${i}`),
    ];
    const log = lines.join("\n");
    const result = extractErrorContext(log);

    expect(result.text).toContain("IllegalArgumentException");
    expect(result.text).toContain("App.main");
  });

  it("preserves head (first 50 lines) and tail (last 50 lines)", () => {
    const head = Array.from({ length: 50 }, (_, i) => `[HEAD] Setup line ${i}`);
    const middle = Array.from(
      { length: 600 },
      (_, i) => `[INFO] Boring middle ${i}`,
    );
    const tail = Array.from(
      { length: 50 },
      (_, i) => `[TAIL] Result line ${i}`,
    );
    const lines = [...head, ...middle, ...tail];
    const log = lines.join("\n");
    const result = extractErrorContext(log);

    // Head preserved
    expect(result.text).toContain("[HEAD] Setup line 0");
    expect(result.text).toContain("[HEAD] Setup line 49");
    // Tail preserved
    expect(result.text).toContain("[TAIL] Result line 0");
    expect(result.text).toContain("[TAIL] Result line 49");
    // Most middle lines gone
    expect(result.stats.outputLines).toBeLessThan(200);
  });

  it("merges overlapping context windows", () => {
    const lines = [
      ...Array.from({ length: 200 }, (_, i) => `[INFO] Start ${i}`),
      "[ERROR] First error",
      "[ERROR] Second error right after",
      "[WARNING] Related warning",
      ...Array.from({ length: 400 }, (_, i) => `[INFO] End ${i}`),
    ];
    const log = lines.join("\n");
    const result = extractErrorContext(log);

    // All three signal lines should be present (not duplicated)
    expect(result.text).toContain("First error");
    expect(result.text).toContain("Second error");
    expect(result.text).toContain("Related warning");
    // Content lines should not be duplicated (omission markers may repeat)
    const outputLines = result.text.split("\n");
    const contentLines = outputLines.filter(
      (l) => !l.includes("lines omitted by PulsCI"),
    );
    const unique = new Set(contentLines);
    expect(unique.size).toBe(contentLines.length);
  });

  it("works with .NET error patterns", () => {
    const lines = [
      ...Array.from({ length: 300 }, (_, i) => `  Compiling assembly-${i}`),
      "Build FAILED.",
      "  error CS1002: ; expected",
      "  at Program.cs:line 42",
      ...Array.from({ length: 300 }, (_, i) => `  Cleanup ${i}`),
    ];
    const log = lines.join("\n");
    const result = extractErrorContext(log);

    expect(result.text).toContain("Build FAILED");
    expect(result.text).toContain("error CS1002");
  });

  it("works with Python traceback patterns", () => {
    const lines = [
      ...Array.from({ length: 300 }, (_, i) => `Installing package-${i}`),
      "Traceback (most recent call last):",
      '  File "app.py", line 10, in main',
      "    raise ValueError('bad config')",
      "ValueError: bad config",
      ...Array.from({ length: 300 }, (_, i) => `Collecting dep-${i}`),
    ];
    const log = lines.join("\n");
    const result = extractErrorContext(log);

    expect(result.text).toContain("Traceback");
    expect(result.text).toContain("ValueError: bad config");
  });

  it("works with Go test failure patterns", () => {
    const lines = [
      ...Array.from({ length: 300 }, (_, i) => `ok  \tpkg/module${i}\t0.${i}s`),
      "--- FAIL: TestUserCreate (0.01s)",
      "    user_test.go:42: expected 200, got 500",
      "FAIL\tpkg/user\t0.015s",
      ...Array.from({ length: 300 }, (_, i) => `ok  \tpkg/other${i}\t0.${i}s`),
    ];
    const log = lines.join("\n");
    const result = extractErrorContext(log);

    expect(result.text).toContain("FAIL: TestUserCreate");
    expect(result.text).toContain("expected 200, got 500");
  });

  it("inserts extraction markers where content was removed", () => {
    const lines = [
      ...Array.from({ length: 100 }, (_, i) => `[INFO] Section A ${i}`),
      "[ERROR] Something broke",
      ...Array.from({ length: 400 }, (_, i) => `[INFO] Section B ${i}`),
      "[ERROR] Another thing broke",
      ...Array.from({ length: 100 }, (_, i) => `[INFO] Section C ${i}`),
    ];
    const log = lines.join("\n");
    const result = extractErrorContext(log);

    expect(result.text).toContain("[... lines omitted by PulsCI ...]");
  });

  it("reports accurate stats", () => {
    const lines = [
      ...Array.from({ length: 300 }, (_, i) => `[INFO] Noise ${i}`),
      "[ERROR] The real error",
      ...Array.from({ length: 300 }, (_, i) => `[INFO] More noise ${i}`),
    ];
    const log = lines.join("\n");
    const result = extractErrorContext(log);

    expect(result.stats.inputLines).toBe(lines.length);
    expect(result.stats.outputLines).toBeLessThan(lines.length);
    expect(result.stats.extracted).toBe(true);
    expect(result.stats.errorRegions).toBeGreaterThanOrEqual(1);
  });
});
