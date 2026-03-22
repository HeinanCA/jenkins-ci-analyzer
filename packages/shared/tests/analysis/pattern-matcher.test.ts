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
    expect(results[0].context).toBeDefined();
  });

  it("detects OOM via Java heap space", () => {
    const log = "java.lang.OutOfMemoryError: Java heap space";
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "oom")).toBe(true);
  });

  it("detects TypeScript compilation error with context", () => {
    const log = [
      'src/models/user.ts(47,10): error TS2304: Cannot find name "UserProfile".',
      "Found 1 error in src/models/user.ts:47",
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "compilation-ts")).toBe(true);
    const tsMatch = results.find((r) => r.pattern.id === "compilation-ts");
    expect(tsMatch?.context.filePath).toBe("src/models/user.ts");
    expect(tsMatch?.context.fileLine).toBe(47);
    expect(tsMatch?.context.exceptionType).toBe("TS2304");
  });

  it("detects JUnit test failures", () => {
    const log = [
      "Tests run: 42, Failures: 3, Errors: 0, Skipped: 1",
      "FAILED [com.example.UserServiceTest]",
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "test-failure-junit")).toBe(
      true,
    );
  });

  it("detects Jest test failures", () => {
    const log = [
      "FAIL src/components/UserCard.test.tsx",
      "  ● UserCard > should display role badge",
      '    Expected: "admin"',
      "    Received: undefined",
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "test-failure-jest")).toBe(
      true,
    );
    const jestMatch = results.find((r) => r.pattern.id === "test-failure-jest");
    expect(jestMatch?.context.filePath).toBe(
      "src/components/UserCard.test.tsx",
    );
    expect(jestMatch?.context.expected).toContain("admin");
    expect(jestMatch?.context.actual).toContain("undefined");
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

  it("detects npm dependency resolution failures", () => {
    const log =
      "npm ERR! 404 Not Found - GET https://registry.npmjs.org/nonexistent-pkg";
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "dependency-npm")).toBe(true);
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

  it("detects Spring context failures", () => {
    const log = [
      "Error creating bean with name 'patientService'",
      "Caused by: org.springframework.beans.factory.NoSuchBeanDefinitionException: No qualifying bean",
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "spring-context")).toBe(true);
    const springMatch = results.find((r) => r.pattern.id === "spring-context");
    expect(springMatch?.context.details?.beanName).toBe("patientService");
    expect(springMatch?.context.rootCause).toContain(
      "NoSuchBeanDefinitionException",
    );
  });

  it("extracts context from real Surefire failure summary", () => {
    const log = [
      "[INFO] Running com.neteera.lib.util.RequestAuthorizationUtilsTests",
      "[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 8.391 s -- in com.neteera.lib.util.RequestAuthorizationUtilsTests",
      "[ERROR] com.biotmed.service.alert.server.alert.ml.AttentionAlertTest.produceAttentionAlert_ShouldSaveToDatabase -- Time elapsed: 0.030 s <<< FAILURE!",
      "org.opentest4j.AssertionFailedError: Alert should be saved in the database ==> expected: <true> but was: <false>",
      "\tat org.junit.jupiter.api.AssertionFailureBuilder.build(AssertionFailureBuilder.java:151)",
      "\tat com.biotmed.service.alert.server.alert.ml.AttentionAlertTest.produceAttentionAlert_ShouldSaveToDatabase(AttentionAlertTest.java:59)",
      "[ERROR] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0, Time elapsed: 5.794 s <<< FAILURE! -- in com.biotmed.service.alert.server.alert.ml.AttentionAlertTest",
      "[INFO] ",
      "[ERROR] Failures: ",
      "[ERROR]   AttentionAlertTest.produceAttentionAlert_ShouldSaveToDatabase:59 Alert should be saved in the database ==> expected: <true> but was: <false>",
      "[INFO] BUILD FAILURE",
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    const junit = results.find((r) => r.pattern.id === "test-failure-junit");
    expect(junit).toBeDefined();
    expect(junit?.context.testClass).toBe("AttentionAlertTest");
    expect(junit?.context.testName).toBe(
      "produceAttentionAlert_ShouldSaveToDatabase",
    );
    expect(junit?.context.expected).toBe("true");
    expect(junit?.context.actual).toBe("false");
    expect(junit?.context.fileLine).toBe(59);
  });

  it("extracts context from CRA Failed to compile with ESLint error", () => {
    const log = [
      "> react-app-rewired build",
      "",
      "Creating an optimized production build...",
      "Failed to compile.",
      "",
      "[eslint] ESLint configuration in .eslintrc.js >> plugin:cypress/recommended is invalid:",
      '\t- Unexpected top-level property "name".',
      "",
      "Referenced from: /home/jenkins/workspace/github_web_web-modern_PR-1787/.eslintrc.js",
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    const webpack = results.find((r) => r.pattern.id === "compilation-webpack");
    expect(webpack).toBeDefined();
    expect(webpack?.context.rootCause).toContain("ESLint configuration");
    expect(webpack?.context.rootCause).toContain("cypress/recommended");
    expect(webpack?.context.assertion).toContain(
      "Unexpected top-level property",
    );
    expect(webpack?.context.filePath).toContain(".eslintrc.js");
  });

  it("detects port in use errors", () => {
    const log = "java.net.BindException: Address already in use";
    const results = analyzeLog(log, FAILURE_PATTERNS);
    expect(results.some((r) => r.pattern.id === "port-in-use")).toBe(true);
  });

  it("returns only the first match per pattern (no duplicates)", () => {
    const log = [
      'error TS2304: Cannot find name "Foo".',
      'error TS2304: Cannot find name "Bar".',
      'error TS2304: Cannot find name "Baz".',
    ].join("\n");
    const results = analyzeLog(log, FAILURE_PATTERNS);
    const compilationMatches = results.filter(
      (r) => r.pattern.id === "compilation-ts",
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
    expect(ids).toContain("dependency-npm");
    expect(ids).toContain("compilation-ts");
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
