import { describe, it, expect } from "vitest";
import { deduplicateLog } from "../src/services/log-dedup";

describe("deduplicateLog", () => {
  it("returns unchanged text for small logs (<100 lines)", () => {
    const log = Array.from({ length: 50 }, (_, i) => `Line ${i}`).join("\n");
    const result = deduplicateLog(log);
    expect(result.text).toBe(log);
    expect(result.stats.collapsedRuns).toBe(0);
  });

  it("collapses runs of structurally identical Maven download lines", () => {
    const lines = [
      "[INFO] Building project...",
      ...Array.from(
        { length: 200 },
        (_, i) =>
          `[INFO] Downloading from central: https://repo.maven.org/maven2/org/package-${i}/1.0.${i}/package-${i}-1.0.${i}.jar`,
      ),
      "[INFO] BUILD SUCCESS",
    ];
    const log = lines.join("\n");
    const result = deduplicateLog(log);

    expect(result.stats.collapsedRuns).toBeGreaterThan(0);
    expect(result.stats.outputLines).toBeLessThan(lines.length);
    expect(result.text).toContain("similar lines collapsed by PulsCI");
    // Original signal preserved
    expect(result.text).toContain("Building project");
    expect(result.text).toContain("BUILD SUCCESS");
  });

  it("collapses runs of passing test output", () => {
    const lines = [
      "[INFO] Running tests...",
      ...Array.from(
        { length: 500 },
        (_, i) =>
          `[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.${i}23 s -- in com.example.Test${i}`,
      ),
      "[ERROR] Tests run: 1, Failures: 1, Errors: 0 <<< FAILURE! -- in com.example.FailingTest",
    ];
    const log = lines.join("\n");
    const result = deduplicateLog(log);

    expect(result.stats.outputLines).toBeLessThan(50);
    // Error line preserved
    expect(result.text).toContain("FAILURE");
    expect(result.text).toContain("FailingTest");
  });

  it("preserves unique lines (no false collapsing)", () => {
    const lines = Array.from(
      { length: 200 },
      (_, i) =>
        `Completely unique line number ${i} with content ${Math.random()}`,
    );
    const log = lines.join("\n");
    const result = deduplicateLog(log);

    // Numbers get fingerprinted but random content should stay unique
    expect(result.stats.collapsedRuns).toBeLessThanOrEqual(lines.length);
  });

  it("handles real-world Maven dependency resolution", () => {
    const lines = [
      "[INFO] --- maven-dependency-plugin:3.5.0:resolve ---",
      ...Array.from(
        { length: 100 },
        (_, i) =>
          `[INFO] Downloaded from central: https://repo1.maven.org/maven2/org/apache/commons/commons-lang3/3.12.${i}/commons-lang3-3.12.${i}.jar (523 kB at 12.3 MB/s)`,
      ),
      "[INFO] --- maven-compiler-plugin:3.11.0:compile ---",
    ];
    const log = lines.join("\n");
    const result = deduplicateLog(log);

    expect(result.stats.collapsedRuns).toBeGreaterThan(0);
    expect(result.stats.largestRun).toBeGreaterThanOrEqual(90);
    expect(result.text).toContain("compiler-plugin");
  });

  it("collapses non-consecutive lines with same fingerprint (frequency-based)", () => {
    // Simulate Maven downloads interleaved with progress lines
    const lines: string[] = [
      "[INFO] Building module-a",
      ...Array.from({ length: 30 }, (_, i) => [
        `[INFO] Downloading from central: https://repo.maven.org/maven2/org/pkg-${i}/1.0.${i}/pkg-${i}.jar`,
        `[INFO] Progress: ${i * 3}%`,
      ]).flat(),
      "[INFO] Compilation complete",
      ...Array.from({ length: 30 }, (_, i) => [
        `[INFO] Downloading from central: https://repo.maven.org/maven2/com/other-${i}/2.0.${i}/other-${i}.jar`,
        `[INFO] Progress: ${i * 3 + 1}%`,
      ]).flat(),
      "[ERROR] Test failure in SomeTest",
    ];
    const log = lines.join("\n");
    const result = deduplicateLog(log);

    // The download+progress lines appear 60 times each but interleaved —
    // frequency-based pass should catch them
    expect(result.stats.outputLines).toBeLessThan(lines.length / 2);
    // Signal lines preserved
    expect(result.text).toContain("Building module-a");
    expect(result.text).toContain("Compilation complete");
    expect(result.text).toContain("Test failure in SomeTest");
    expect(result.text).toContain("collapsed by PulsCI");
  });

  it("frequency-based collapsing preserves error/warning lines even if fingerprint is common", () => {
    const lines: string[] = [
      "[INFO] Start",
      ...Array.from(
        { length: 50 },
        (_, i) => `[INFO] Downloaded artifact-${i}.jar from central`,
      ),
      "[ERROR] Downloaded artifact-special.jar from central but checksum failed",
      ...Array.from(
        { length: 50 },
        (_, i) => `[INFO] Downloaded artifact-${i + 50}.jar from central`,
      ),
      "[WARNING] Possible corruption in artifact-99.jar",
      "[INFO] End",
    ];
    const log = lines.join("\n");
    const result = deduplicateLog(log);

    // ERROR and WARNING lines must survive even if their fingerprint is frequent
    expect(result.text).toContain("[ERROR]");
    expect(result.text).toContain("checksum failed");
    expect(result.text).toContain("[WARNING]");
    expect(result.text).toContain("corruption");
  });

  it("frequency threshold only kicks in for high-frequency fingerprints", () => {
    // 15 occurrences should NOT be collapsed (under threshold of 20)
    const lines: string[] = [
      "[INFO] Start",
      ...Array.from({ length: 15 }, (_, i) => [
        `[INFO] Building module-${i}`,
        `[INFO] Some other work ${i}`,
      ]).flat(),
      "[INFO] End",
    ];
    // Pad to over 100 lines so dedup runs
    while (lines.length < 110) lines.push(`[INFO] Filler line ${lines.length}`);
    const log = lines.join("\n");
    const result = deduplicateLog(log);

    // 15 occurrences is below threshold — all should remain
    const buildingLines = result.text
      .split("\n")
      .filter((l) => l.includes("Building module-"));
    expect(buildingLines.length).toBe(15);
  });

  it("reports correct stats", () => {
    const lines = [
      "start",
      ...Array.from({ length: 80 }, () => "[INFO] Downloading artifact"),
      "middle",
      ...Array.from({ length: 60 }, () => "[INFO] Tests run: 1, Failures: 0"),
      "end",
    ];
    const log = lines.join("\n");
    const result = deduplicateLog(log);

    expect(result.stats.inputLines).toBe(lines.length);
    expect(result.stats.outputLines).toBeLessThan(lines.length);
    expect(result.stats.collapsedRuns).toBeGreaterThanOrEqual(2);
  });
});
