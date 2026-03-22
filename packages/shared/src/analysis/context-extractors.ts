import type { ContextExtractor, ExtractedContext } from "./types";

function scanNearby(
  lines: readonly string[],
  matchIndex: number,
  range: number,
): readonly string[] {
  const start = Math.max(0, matchIndex - range);
  const end = Math.min(lines.length, matchIndex + range + 1);
  return lines.slice(start, end);
}

function extractAppStackFrames(
  lines: readonly string[],
  matchIndex: number,
): readonly string[] {
  const frames: string[] = [];
  for (
    let i = matchIndex + 1;
    i < Math.min(lines.length, matchIndex + 50);
    i++
  ) {
    const line = lines[i].trim();
    if (!line.startsWith("at ") && !line.startsWith("at\t")) break;
    // Skip framework internals
    if (
      line.includes("java.lang.reflect") ||
      line.includes("sun.reflect") ||
      line.includes("org.junit") ||
      line.includes("org.mockito") ||
      line.includes("org.springframework.test") ||
      line.includes("org.apache.maven") ||
      line.includes("org.gradle")
    )
      continue;
    frames.push(line);
    if (frames.length >= 5) break;
  }
  return frames;
}

// ─── Java/JUnit/Maven ───────────────────────────────────────

export const extractJunitContext: ContextExtractor = (lines, matchIndex) => {
  const ctx: Record<string, unknown> = {};
  const nearby = scanNearby(lines, matchIndex, 100);

  // Find test class and method: "testMethodName(com.example.MyTest)"
  const testMethodMatch = nearby.find(
    (l) =>
      /\w+\([\w.]+\)/.test(l) &&
      (l.includes("FAILED") || l.includes("<<< FAIL")),
  );
  if (testMethodMatch) {
    const m = testMethodMatch.match(/(\w+)\(([\w.]+)\)/);
    if (m) {
      ctx.testName = m[1];
      ctx.testClass = m[2];
    }
  }

  // Find assertion: "expected:<X> but was:<Y>" or "Expected: X / Actual: Y"
  const assertionLine = nearby.find(
    (l) =>
      /expected:?\s*<.*>\s*but\s*was:?\s*<.*>/i.test(l) ||
      /Expected\s*:.*\n?.*Actual\s*:/i.test(l) ||
      /AssertionError|AssertError/i.test(l),
  );
  if (assertionLine) {
    ctx.assertion = assertionLine.trim();
    const expectedMatch = assertionLine.match(/expected:?\s*<?([^>]+)>?/i);
    const actualMatch = assertionLine.match(/but\s*was:?\s*<?([^>]+)>?/i);
    if (expectedMatch) ctx.expected = expectedMatch[1].trim();
    if (actualMatch) ctx.actual = actualMatch[1].trim();
  }

  // Find exception type
  const exceptionLine = nearby.find((l) =>
    /^\s*([\w.]+Exception|[\w.]+Error):/.test(l),
  );
  if (exceptionLine) {
    const m = exceptionLine.match(/([\w.]+(?:Exception|Error)):/);
    if (m) ctx.exceptionType = m[1];
  }

  // Find deepest "Caused by:"
  const causedByLines = nearby.filter((l) => l.trim().startsWith("Caused by:"));
  if (causedByLines.length > 0) {
    ctx.rootCause = causedByLines[causedByLines.length - 1].trim();
  }

  // Stack trace (app frames only)
  const exIdx = nearby.findIndex((l) => /Exception|Error|at\s+/.test(l));
  if (exIdx >= 0) {
    const absIdx = Math.max(0, matchIndex - 100) + exIdx;
    ctx.stackTrace = extractAppStackFrames(lines, absIdx);
  }

  // Maven module
  const moduleLine = nearby.find((l) => /\[ERROR\].*in\s+module\s+/i.test(l));
  if (moduleLine) {
    const m = moduleLine.match(/module\s+([\w-]+)/i);
    if (m) ctx.module = m[1];
  }

  return ctx as ExtractedContext;
};

// ─── TypeScript / ESLint ────────────────────────────────────

export const extractTypeScriptContext: ContextExtractor = (
  lines,
  matchIndex,
) => {
  const ctx: Record<string, unknown> = {};

  // Extract file path and line: "src/foo.ts(42,17): error TS2304: ..."
  const tsMatch = lines[matchIndex]?.match(
    /([^\s(]+\.tsx?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.*)/,
  );
  if (tsMatch) {
    ctx.filePath = tsMatch[1];
    ctx.fileLine = Number(tsMatch[2]);
    ctx.exceptionType = tsMatch[4];
    ctx.rootCause = tsMatch[5];
  }

  // Count total errors to detect cascade
  const errorLines = lines.filter((l) => /error TS\d+/.test(l));
  if (errorLines.length > 1) {
    ctx.details = { totalErrors: String(errorLines.length) };
  }

  return ctx as ExtractedContext;
};

// ─── Jest / Vitest ──────────────────────────────────────────

export const extractJestContext: ContextExtractor = (lines, matchIndex) => {
  const ctx: Record<string, unknown> = {};
  const nearby = scanNearby(lines, matchIndex, 80);

  // Find test name: "● TestSuite > test name" or "FAIL src/..."
  const testNameLine = nearby.find((l) => /●\s+/.test(l));
  if (testNameLine) {
    const m = testNameLine.match(/●\s+(.*)/);
    if (m) {
      const parts = m[1].split(" > ");
      ctx.testClass = parts[0]?.trim();
      ctx.testName = parts.slice(1).join(" > ").trim() || parts[0]?.trim();
    }
  }

  // Find assertion: "Expected: X / Received: Y"
  const expectedLine = nearby.find((l) => /Expected:/.test(l));
  const receivedLine = nearby.find((l) => /Received:/.test(l));
  if (expectedLine) {
    ctx.expected = expectedLine.replace(/.*Expected:\s*/, "").trim();
  }
  if (receivedLine) {
    ctx.actual = receivedLine.replace(/.*Received:\s*/, "").trim();
  }
  if (expectedLine && receivedLine) {
    ctx.assertion = `Expected: ${ctx.expected}\nReceived: ${ctx.actual}`;
  }

  // Find file path from FAIL line
  const failLine = nearby.find((l) => /FAIL\s+src\//.test(l));
  if (failLine) {
    const m = failLine.match(/FAIL\s+(src\/\S+)/);
    if (m) ctx.filePath = m[1];
  }

  // Snapshot diff
  const snapshotLine = nearby.find((l) =>
    /Snapshot.*\d+.*obsolete|toMatchSnapshot/i.test(l),
  );
  if (snapshotLine) {
    ctx.details = {
      ...((ctx.details as Record<string, string>) ?? {}),
      snapshotFailure: "true",
    };
  }

  return ctx as ExtractedContext;
};

// ─── Spring Context Failures ────────────────────────────────

export const extractSpringContext: ContextExtractor = (lines, matchIndex) => {
  const ctx: Record<string, unknown> = {};
  const nearby = scanNearby(lines, matchIndex, 50);

  // Bean name
  const beanLine = nearby.find((l) => /Error creating bean with name/.test(l));
  if (beanLine) {
    const m = beanLine.match(/bean with name '([^']+)'/);
    if (m) ctx.details = { beanName: m[1] };
  }

  // Deepest Caused by:
  const causedByLines = nearby.filter((l) => l.trim().startsWith("Caused by:"));
  if (causedByLines.length > 0) {
    const last = causedByLines[causedByLines.length - 1];
    ctx.rootCause = last.replace("Caused by:", "").trim();
    const exMatch = last.match(/([\w.]+(?:Exception|Error))/);
    if (exMatch) ctx.exceptionType = exMatch[1];
  }

  return ctx as ExtractedContext;
};

// ─── npm / Dependency ───────────────────────────────────────

export const extractNpmContext: ContextExtractor = (lines, matchIndex) => {
  const ctx: Record<string, unknown> = {};
  const nearby = scanNearby(lines, matchIndex, 30);

  // Peer dependency conflict
  const peerLine = nearby.find((l) => /peer dep|ERESOLVE/i.test(l));
  if (peerLine) {
    ctx.rootCause = peerLine.trim();
  }

  // Package name from 404
  const notFoundLine = nearby.find((l) => /404.*Not Found/i.test(l));
  if (notFoundLine) {
    const m = notFoundLine.match(/GET\s+\S+\/([@\w/-]+)/);
    if (m) ctx.details = { package: m[1] };
  }

  return ctx as ExtractedContext;
};

// ─── Generic fallback ───────────────────────────────────────

export const extractGenericContext: ContextExtractor = (lines, matchIndex) => {
  const ctx: Record<string, unknown> = {};
  const nearby = scanNearby(lines, matchIndex, 20);

  // Try to find a file:line reference
  const fileLineMatch = nearby.find((l) => /[\w/]+\.\w+[:(]\d+/.test(l));
  if (fileLineMatch) {
    const m = fileLineMatch.match(/([\w/.-]+\.\w+)[:(](\d+)/);
    if (m) {
      ctx.filePath = m[1];
      ctx.fileLine = Number(m[2]);
    }
  }

  // Try to find a Caused by or root cause
  const causedBy = nearby.find((l) => /Caused by:|Root cause:/i.test(l));
  if (causedBy) {
    ctx.rootCause = causedBy.trim();
  }

  return ctx as ExtractedContext;
};
