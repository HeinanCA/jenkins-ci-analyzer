import { describe, it, expect } from "vitest";
import { analyzeLog } from "../../src/analysis/pattern-matcher";
import { FAILURE_PATTERNS } from "../../src/analysis/failure-patterns";

describe("analyzeLog", () => {
  it("returns empty array for empty log", () => {
    const results = analyzeLog("", FAILURE_PATTERNS);
    expect(results).toEqual([]);
  });

  it("returns empty array for clean log with no errors", () => {
    const log = [
      "Starting build...",
      "Compiling sources...",
      "Running tests...",
      "All 42 tests passed.",
      "BUILD SUCCESS",
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results).toEqual([]);
  });

  it("detects OOM via exit code 137", () => {
    const log = [
      "Running tests...",
      "Process exited with exit code 137",
      "Build failed.",
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].pattern.id).toBe("oom");
    expect(results[0].matchedLine).toContain("exit code 137");
    expect(results[0].lineNumber).toBe(2);
  });

  it("detects OOM via Java heap space", () => {
    const log = "java.lang.OutOfMemoryError: Java heap space";
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "oom")).toBe(true);
  });

  it("detects compilation error via TypeScript error code", () => {
    const log = [
      'src/models/user.ts(47,10): error TS2304: Cannot find name "UserProfile".',
      "Found 1 error in src/models/user.ts:47",
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "compilation")).toBe(true);
  });

  it("detects test failures", () => {
    const log = [
      "Tests run: 42, Failures: 3, Errors: 0, Skipped: 1",
      "FAILED [com.example.UserServiceTest]",
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "test-failure")).toBe(true);
  });

  it("detects disk full errors", () => {
    const log = "write: No space left on device";
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "disk-full")).toBe(true);
  });

  it("detects agent disconnected errors", () => {
    const log = "java.nio.channels.ClosedChannelException";
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "agent-disconnected")).toBe(
      true,
    );
  });

  it("detects network failures", () => {
    const log = "java.net.UnknownHostException: registry.npmjs.org";
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "network")).toBe(true);
  });

  it("detects dependency resolution failures", () => {
    const log =
      "npm ERR! 404 Not Found - GET https://registry.npmjs.org/nonexistent-pkg";
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "dependency")).toBe(true);
  });

  it("detects Docker daemon issues", () => {
    const log =
      "Cannot connect to the Docker daemon at unix:///var/run/docker.sock";
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "docker")).toBe(true);
  });

  it("detects SCM checkout failures", () => {
    const log =
      "fatal: repository 'https://github.com/org/repo.git/' not found";
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "scm")).toBe(true);
  });

  it("detects lint violations", () => {
    const log = "✖ 12 problems (8 errors, 4 warnings) eslint found error";
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "lint")).toBe(true);
  });

  it("returns only the first match per pattern (no duplicates)", () => {
    const log = [
      'error TS2304: Cannot find name "Foo".',
      'error TS2304: Cannot find name "Bar".',
      'error TS2304: Cannot find name "Baz".',
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    const compilationMatches = results.filter(
      (r) => r.pattern.id === "compilation",
    );
    expect(compilationMatches.length).toBe(1);
  });

  it("detects multiple different failure types in one log", () => {
    const log = [
      "java.net.UnknownHostException: registry.example.com",
      "npm ERR! 404 Not Found",
      'error TS2304: Cannot find name "User".',
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    const ids = results.map((r) => r.pattern.id);
    expect(ids).toContain("network");
    expect(ids).toContain("dependency");
    expect(ids).toContain("compilation");
  });

  it("sorts results by severity (critical first)", () => {
    const log = [
      "eslint found error in src/index.ts",
      "Process exited with exit code 137",
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.length).toBeGreaterThanOrEqual(2);
    const severityOrder = ["critical", "high", "medium", "low"];
    for (let i = 1; i < results.length; i++) {
      const prevIdx = severityOrder.indexOf(results[i - 1].pattern.severity);
      const currIdx = severityOrder.indexOf(results[i].pattern.severity);
      expect(prevIdx).toBeLessThanOrEqual(currIdx);
    }
  });

  it("assigns confidence based on pattern specificity", () => {
    const log = "java.lang.OutOfMemoryError: Java heap space";
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results[0].confidence).toBeGreaterThan(0);
    expect(results[0].confidence).toBeLessThanOrEqual(1);
  });

  it("handles very long logs by scanning last 2000 lines", () => {
    const lines = Array.from(
      { length: 5000 },
      (_, i) => `Line ${i + 1}: normal output`,
    );
    lines[4999] = "Process exited with exit code 137";
    const log = lines.join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "oom")).toBe(true);
  });

  it("does NOT match errors outside the last 2000 lines", () => {
    const lines = Array.from(
      { length: 5000 },
      (_, i) => `Line ${i + 1}: normal output`,
    );
    lines[0] = "Process exited with exit code 137";
    const log = lines.join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "oom")).toBe(false);
  });
});
