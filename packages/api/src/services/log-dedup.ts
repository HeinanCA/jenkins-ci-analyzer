/**
 * Pass 2: Structural Deduplication
 *
 * Fingerprints each line by replacing variable content (timestamps, hashes,
 * numbers, UUIDs, paths) with placeholders. Groups by fingerprint and
 * collapses runs of structurally identical lines.
 *
 * Zero cost. Pure string processing. Handles the 30% of logs that are huge
 * due to repetition (Maven deps, passing tests, Gradle cache, etc.)
 */

// Replace variable content with placeholders to create a structural fingerprint
function fingerprint(line: string): string {
  return (
    line
      // UUIDs
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "<UUID>",
      )
      // SHA hashes (7+ hex chars)
      .replace(/\b[0-9a-f]{7,40}\b/gi, "<SHA>")
      // Timestamps: ISO, Jenkins-style, common formats
      .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*Z?/g, "<TS>")
      .replace(/\d{2}:\d{2}:\d{2}\.\d+/g, "<TS>")
      // Version numbers: 1.2.3, 3.14.0-SNAPSHOT
      .replace(/\d+\.\d+\.\d+[\w.-]*/g, "<VER>")
      // File sizes: 1.2 MB, 345 kB
      .replace(/[\d.]+\s*[kKmMgG][bB]/g, "<SIZE>")
      // Duration: 1.234 s, 12ms, 3.5 min
      .replace(/[\d.]+\s*(?:ms|[smh]|sec|min)\b/g, "<DUR>")
      // Maven artifact coordinates
      .replace(/[\w.-]+:[\w.-]+:[\w.-]+/g, "<MVN>")
      // URLs
      .replace(/https?:\/\/[^\s]+/g, "<URL>")
      // File paths with extensions
      .replace(/\/[\w./-]+\.\w+/g, "<PATH>")
      // Class/method names with numbers (Test0, Test123, handler42)
      .replace(/\b[A-Za-z]+\d+\b/g, "<ID>")
      // Remaining standalone numbers
      .replace(/\b\d+\b/g, "<N>")
      // Trim whitespace for comparison
      .trim()
  );
}

interface DedupStats {
  readonly inputLines: number;
  readonly outputLines: number;
  readonly collapsedRuns: number;
  readonly largestRun: number;
}

interface DedupResult {
  readonly text: string;
  readonly stats: DedupStats;
}

// Lines containing these patterns are never collapsed, even if frequent
const SIGNAL_PATTERN =
  /\[ERROR\]|\[WARNING\]|\bFAIL|\bERROR\b|\bException\b|\bfailed\b/i;

// Minimum frequency before a fingerprint is eligible for collapsing
const FREQUENCY_THRESHOLD = 20;

/**
 * Phase 1: Run-based collapsing — consecutive identical fingerprints.
 * Phase 2: Frequency-based collapsing — non-consecutive identical fingerprints
 *   that appear 20+ times across the entire log.
 */
export function deduplicateLog(text: string): DedupResult {
  const lines = text.split("\n");
  if (lines.length < 100) {
    return {
      text,
      stats: {
        inputLines: lines.length,
        outputLines: lines.length,
        collapsedRuns: 0,
        largestRun: 0,
      },
    };
  }

  // --- Phase 1: Run-based collapsing (consecutive identical fingerprints) ---
  const fingerprints = lines.map((l) => fingerprint(l));
  const phase1: string[] = [];
  const phase1Fps: string[] = [];
  let runStart = -1;
  let runCount = 0;
  let collapsedRuns = 0;
  let largestRun = 0;

  function flushRun(endIndex: number) {
    if (runCount <= 2) {
      for (let i = runStart; i <= endIndex; i++) {
        phase1.push(lines[i]);
        phase1Fps.push(fingerprints[i]);
      }
    } else {
      phase1.push(lines[runStart]);
      phase1Fps.push(fingerprints[runStart]);
      phase1.push(`  ... [${runCount - 2} similar lines collapsed by PulsCI]`);
      phase1Fps.push("__COLLAPSED__");
      phase1.push(lines[endIndex]);
      phase1Fps.push(fingerprints[endIndex]);
      collapsedRuns++;
      if (runCount > largestRun) largestRun = runCount;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const fp = fingerprints[i];
    if (i > 0 && fp === fingerprints[i - 1] && fp.length > 5 && runStart >= 0) {
      runCount++;
    } else {
      if (runStart >= 0) {
        flushRun(i - 1);
      }
      runStart = i;
      runCount = 1;
    }
  }
  if (runStart >= 0) {
    flushRun(lines.length - 1);
  }

  // --- Phase 2: Frequency-based collapsing (non-consecutive) ---
  // Count how often each fingerprint appears in the phase 1 output
  const freqMap = new Map<string, number>();
  for (const fp of phase1Fps) {
    if (fp === "__COLLAPSED__" || fp.length <= 5) continue;
    freqMap.set(fp, (freqMap.get(fp) ?? 0) + 1);
  }

  // Identify high-frequency fingerprints
  const highFreq = new Set<string>();
  for (const [fp, count] of freqMap) {
    if (count >= FREQUENCY_THRESHOLD) {
      highFreq.add(fp);
    }
  }

  if (highFreq.size === 0) {
    // Nothing to collapse in phase 2
    return {
      text: phase1.join("\n"),
      stats: {
        inputLines: lines.length,
        outputLines: phase1.length,
        collapsedRuns,
        largestRun,
      },
    };
  }

  // Second scan: for each high-freq fingerprint, keep first + last occurrence,
  // collapse everything in between
  const seen = new Map<string, number>(); // fp → index of first occurrence
  const lastIndex = new Map<string, number>(); // fp → index of last occurrence

  for (let i = 0; i < phase1.length; i++) {
    const fp = phase1Fps[i];
    if (!highFreq.has(fp)) continue;
    if (!seen.has(fp)) seen.set(fp, i);
    lastIndex.set(fp, i);
  }

  // Mark which lines to suppress (keep first, last, and signal lines)
  const suppress = new Set<number>();
  const suppressedPerFp = new Map<string, number>();

  for (let i = 0; i < phase1.length; i++) {
    const fp = phase1Fps[i];
    if (!highFreq.has(fp)) continue;
    // Always keep signal lines (errors, warnings, failures)
    if (SIGNAL_PATTERN.test(phase1[i])) continue;
    // Keep first and last occurrence
    if (i === seen.get(fp) || i === lastIndex.get(fp)) continue;
    suppress.add(i);
    suppressedPerFp.set(fp, (suppressedPerFp.get(fp) ?? 0) + 1);
  }

  // Build final output, inserting summary lines after first occurrence of each fp
  const summaryInserted = new Set<string>();
  const output: string[] = [];

  for (let i = 0; i < phase1.length; i++) {
    if (suppress.has(i)) continue;

    const fp = phase1Fps[i];
    output.push(phase1[i]);

    // After the first occurrence of a high-freq fingerprint, insert summary
    if (highFreq.has(fp) && i === seen.get(fp) && !summaryInserted.has(fp)) {
      const count = suppressedPerFp.get(fp) ?? 0;
      if (count > 0) {
        output.push(`  ... [${count} similar lines collapsed by PulsCI]`);
        collapsedRuns++;
        if (count > largestRun) largestRun = count;
      }
      summaryInserted.add(fp);
    }
  }

  return {
    text: output.join("\n"),
    stats: {
      inputLines: lines.length,
      outputLines: output.length,
      collapsedRuns,
      largestRun,
    },
  };
}
