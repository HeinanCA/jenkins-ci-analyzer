import type { ContextExtractor, ExtractedContext } from './types';

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
    if (!line.startsWith('at ') && !line.startsWith('\tat')) break;
    if (
      line.includes('java.lang.reflect') ||
      line.includes('sun.reflect') ||
      line.includes('org.junit') ||
      line.includes('org.mockito') ||
      line.includes('org.springframework.test') ||
      line.includes('org.apache.maven') ||
      line.includes('org.gradle')
    )
      continue;
    frames.push(line);
    if (frames.length >= 5) break;
  }
  return frames;
}

// ─── Java/JUnit/Maven (real Surefire format) ────────────────

export const extractJunitContext: ContextExtractor = (lines, matchIndex) => {
  const ctx: Record<string, unknown> = {};

  // Scan a wide range — Surefire summary is often far from the matched line
  const scanStart = Math.max(0, matchIndex - 300);
  const scanEnd = Math.min(lines.length, matchIndex + 100);
  const nearby = lines.slice(scanStart, scanEnd);

  // 1. Surefire compact failure summary:
  //    [ERROR]   ClassName.methodName:lineNumber message ==> expected: <X> but was: <Y>
  const surefireSummaries: string[] = [];
  for (const line of nearby) {
    const m = line.match(
      /\[ERROR\]\s{2,}(\w+)\.(\w+):(\d+)\s+(.*)/,
    );
    if (m) {
      surefireSummaries.push(line);
      if (!ctx.testClass) {
        ctx.testClass = m[1];
        ctx.testName = m[2];
        ctx.fileLine = Number(m[3]);
        const message = m[4];
        ctx.assertion = message;

        // Extract expected/actual from "==> expected: <X> but was: <Y>"
        const evMatch = message.match(
          /expected:\s*<(.+?)>\s*but was:\s*<(.+?)>/,
        );
        if (evMatch) {
          ctx.expected = evMatch[1];
          ctx.actual = evMatch[2];
        }

        // Extract exception from "» RuntimeException message"
        const exMatch = message.match(/[»›]\s*(\w+(?:Exception|Error))\s*(.*)/);
        if (exMatch) {
          ctx.exceptionType = exMatch[1];
          ctx.rootCause = exMatch[2].trim() || exMatch[1];
        }
      }
    }
  }

  // If multiple failures, note the count
  if (surefireSummaries.length > 1) {
    ctx.details = { totalFailures: String(surefireSummaries.length) };
  }

  // 2. Individual test failure line:
  //    [ERROR] com.example.TestClass.testMethod -- Time elapsed: X s <<< FAILURE!
  if (!ctx.testClass) {
    for (const line of nearby) {
      const m = line.match(
        /\[ERROR\]\s+([\w.]+)\.(\w+)\s+--\s+Time elapsed:.*<<<\s+(FAILURE|ERROR)!/,
      );
      if (m) {
        const parts = m[1].split('.');
        ctx.testClass = parts[parts.length - 1];
        ctx.testName = m[2];
        break;
      }
    }
  }

  // 3. Failed test class from results line:
  //    [ERROR] Tests run: N ... <<< FAILURE! -- in com.example.TestClass
  if (!ctx.testClass) {
    for (const line of nearby) {
      const m = line.match(
        /\[ERROR\] Tests run:.*<<<\s+FAILURE!.*(?:--?)\s+in\s+([\w.]+)/,
      );
      if (m) {
        const parts = m[1].split('.');
        ctx.testClass = parts[parts.length - 1];
        break;
      }
    }
  }

  // 4. Exception type from assertion error line
  if (!ctx.exceptionType) {
    for (const line of nearby) {
      const m = line.match(
        /^(org\.[\w.]+(?:Exception|Error)|java\.[\w.]+(?:Exception|Error)):\s*(.*)/,
      );
      if (m) {
        ctx.exceptionType = m[1].split('.').pop();
        if (!ctx.assertion) ctx.assertion = m[2];
        break;
      }
    }
  }

  // 5. Stack trace — app frames only
  for (let i = 0; i < nearby.length; i++) {
    if (/(?:Exception|Error):/.test(nearby[i])) {
      const absIdx = scanStart + i;
      ctx.stackTrace = extractAppStackFrames(lines, absIdx);
      break;
    }
  }

  // 6. Deepest Caused by:
  const causedByLines = nearby.filter((l) =>
    l.trim().startsWith('Caused by:'),
  );
  if (causedByLines.length > 0) {
    ctx.rootCause = causedByLines[causedByLines.length - 1]
      .replace('Caused by:', '')
      .trim();
  }

  // 7. Maven module from reactor summary
  for (const line of nearby) {
    const m = line.match(
      /\[INFO\]\s+([\w-]+)\s+\.{2,}\s+FAILURE/,
    );
    if (m) {
      ctx.module = m[1];
      break;
    }
  }

  return ctx as ExtractedContext;
};

// ─── TypeScript ─────────────────────────────────────────────

export const extractTypeScriptContext: ContextExtractor = (lines, matchIndex) => {
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

// ─── CRA / Webpack / Vite build failures ────────────────────

export const extractWebpackContext: ContextExtractor = (lines, matchIndex) => {
  const ctx: Record<string, unknown> = {};
  const nearby = scanNearby(lines, matchIndex, 30);

  // ESLint config error:
  // [eslint] ESLint configuration in .eslintrc.js >> plugin:X is invalid:
  //   - Unexpected top-level property "name".
  // Referenced from: /path/.eslintrc.js
  const eslintLine = nearby.find((l) => /\[eslint\]/.test(l));
  if (eslintLine) {
    ctx.rootCause = eslintLine.replace(/.*\[eslint\]\s*/, '').trim();

    const detailLine = nearby.find((l) => /^\s+-\s+/.test(l));
    if (detailLine) {
      ctx.assertion = detailLine.trim().replace(/^-\s*/, '');
    }

    const refLine = nearby.find((l) => /Referenced from:/.test(l));
    if (refLine) {
      const m = refLine.match(/Referenced from:\s*(.*)/);
      if (m) ctx.filePath = m[1].trim();
    }
  }

  // Module not found: Can't resolve './foo' in '/path/to/dir'
  const moduleNotFound = nearby.find((l) => /Module not found/i.test(l));
  if (moduleNotFound) {
    ctx.rootCause = moduleNotFound.trim();
    const m = moduleNotFound.match(/Can't resolve '([^']+)'/i);
    if (m) ctx.details = { missingModule: m[1] };
  }

  // Generic webpack error
  if (!ctx.rootCause) {
    const errorLine = nearby.find(
      (l) => /ERROR in/.test(l) || /error\s+in/i.test(l),
    );
    if (errorLine) {
      ctx.rootCause = errorLine.trim();
    }
  }

  return ctx as ExtractedContext;
};

// ─── Jest / Vitest ──────────────────────────────────────────

export const extractJestContext: ContextExtractor = (lines, matchIndex) => {
  const ctx: Record<string, unknown> = {};
  const nearby = scanNearby(lines, matchIndex, 80);

  // Test name: "● TestSuite > test name"
  const testNameLine = nearby.find((l) => /●\s+/.test(l));
  if (testNameLine) {
    const m = testNameLine.match(/●\s+(.*)/);
    if (m) {
      const parts = m[1].split(' > ');
      ctx.testClass = parts[0]?.trim();
      ctx.testName = parts.slice(1).join(' > ').trim() || parts[0]?.trim();
    }
  }

  // Assertion: "Expected: X" / "Received: Y"
  const expectedLine = nearby.find((l) => /Expected:/.test(l));
  const receivedLine = nearby.find((l) => /Received:/.test(l));
  if (expectedLine) {
    ctx.expected = expectedLine.replace(/.*Expected:\s*/, '').trim();
  }
  if (receivedLine) {
    ctx.actual = receivedLine.replace(/.*Received:\s*/, '').trim();
  }
  if (expectedLine && receivedLine) {
    ctx.assertion = `Expected: ${ctx.expected}\nReceived: ${ctx.actual}`;
  }

  // File path from FAIL line
  const failLine = nearby.find((l) => /FAIL\s+src\//.test(l));
  if (failLine) {
    const m = failLine.match(/FAIL\s+(src\/\S+)/);
    if (m) ctx.filePath = m[1];
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
  const causedByLines = nearby.filter((l) =>
    l.trim().startsWith('Caused by:'),
  );
  if (causedByLines.length > 0) {
    const last = causedByLines[causedByLines.length - 1];
    ctx.rootCause = last.replace('Caused by:', '').trim();
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

  // file:line reference
  const fileLineMatch = nearby.find((l) => /[\w/]+\.\w+[:(]\d+/.test(l));
  if (fileLineMatch) {
    const m = fileLineMatch.match(/([\w/.-]+\.\w+)[:(](\d+)/);
    if (m) {
      ctx.filePath = m[1];
      ctx.fileLine = Number(m[2]);
    }
  }

  // Caused by or root cause
  const causedBy = nearby.find((l) => /Caused by:|Root cause:/i.test(l));
  if (causedBy) {
    ctx.rootCause = causedBy.trim();
  }

  return ctx as ExtractedContext;
};
