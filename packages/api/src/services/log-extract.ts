/**
 * Pass 3: Error-Proximity Extraction
 *
 * Finds error/failure/exception markers in the log and keeps only
 * those lines plus a context window around them. Preserves the head
 * (build setup) and tail (build result) of the log.
 *
 * Generic across all build tools — errors universally use markers like
 * ERROR, FAIL, Exception, Traceback, panic, ERR!.
 *
 * Zero cost. Pure string processing.
 */

// Universal error signal patterns — not build-tool-specific
const ERROR_SIGNAL =
  /\bERROR\b|\bFAIL\b|\bFAILED\b|\bFAILURE\b|Exception[:\s]|\bTraceback\b|\bpanic[:(]|\bERR!|\berror\b(?:\s+[A-Z]{2}\d+|\[E)/i;

// Lines before an error marker to keep for context
const CONTEXT_BEFORE = 10;
// Lines after an error marker to keep for context
const CONTEXT_AFTER = 5;
// Lines to always keep from the start of the log (build setup)
const HEAD_LINES = 50;
// Lines to always keep from the end of the log (build result)
const TAIL_LINES = 50;
// Minimum log size before extraction kicks in
const MIN_LINES = 500;

const OMISSION_MARKER = "  [... lines omitted by PulsCI ...]";

interface ExtractStats {
  readonly inputLines: number;
  readonly outputLines: number;
  readonly extracted: boolean;
  readonly errorRegions: number;
}

interface ExtractResult {
  readonly text: string;
  readonly stats: ExtractStats;
}

export function extractErrorContext(text: string): ExtractResult {
  const lines = text.split("\n");

  if (lines.length < MIN_LINES) {
    return {
      text,
      stats: {
        inputLines: lines.length,
        outputLines: lines.length,
        extracted: false,
        errorRegions: 0,
      },
    };
  }

  // Mark which lines to keep
  const keep = new Set<number>();

  // Always keep head and tail
  for (let i = 0; i < Math.min(HEAD_LINES, lines.length); i++) {
    keep.add(i);
  }
  for (let i = Math.max(0, lines.length - TAIL_LINES); i < lines.length; i++) {
    keep.add(i);
  }

  // Find error markers and keep context windows around them
  let errorRegions = 0;
  for (let i = 0; i < lines.length; i++) {
    if (ERROR_SIGNAL.test(lines[i])) {
      // Check if this starts a new region (not already in a kept window)
      const isNewRegion = !keep.has(i);
      if (isNewRegion) errorRegions++;

      const from = Math.max(0, i - CONTEXT_BEFORE);
      const to = Math.min(lines.length - 1, i + CONTEXT_AFTER);
      for (let j = from; j <= to; j++) {
        keep.add(j);
      }
    }
  }

  // Build output, inserting omission markers where content was removed
  const output: string[] = [];
  let lastKept = -1;

  for (let i = 0; i < lines.length; i++) {
    if (!keep.has(i)) continue;

    // If there's a gap since the last kept line, insert marker
    if (lastKept >= 0 && i > lastKept + 1) {
      output.push(OMISSION_MARKER);
    }

    output.push(lines[i]);
    lastKept = i;
  }

  return {
    text: output.join("\n"),
    stats: {
      inputLines: lines.length,
      outputLines: output.length,
      extracted: true,
      errorRegions,
    },
  };
}
