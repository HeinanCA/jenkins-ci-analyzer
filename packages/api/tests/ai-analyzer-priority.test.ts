/**
 * TDD tests for priority field in AI analyzer Zod schema.
 *
 * Verifies:
 *   - AiAnalysisResultSchema rejects results missing `priority`
 *   - AiAnalysisResultSchema rejects results with invalid priority values
 *   - AiAnalysisResultSchema accepts all valid FailurePriority values
 *   - PRIORITY_ORDER assigns correct sort weights
 *   - PRIORITY_LABEL assigns correct display labels
 */
import { describe, it, expect } from "vitest";
import { AiAnalysisResultSchema } from "../src/services/ai-analyzer";
import { PRIORITY_ORDER, PRIORITY_LABEL } from "@tig/shared";

const BASE_RESULT = {
  summary: "Build failed due to test assertion error",
  classification: "code" as const,
  rootCause: "AssertionError: expected 42 but got 0",
  failingTest: "com.example.FooTest#testBar",
  assertion: "expected: <42> but was: <0>",
  filePath: "src/FooTest.java",
  lineNumber: 55,
  exceptionType: "AssertionError",
  stackTrace: ["com.example.FooTest.testBar(FooTest.java:55)"],
  suggestedFixes: ["mvn test -pl alert-service -Dtest=FooTest#testBar"],
  confidence: 0.9,
};

describe("AiAnalysisResultSchema — priority field", () => {
  it("rejects result missing priority field", () => {
    const result = AiAnalysisResultSchema.safeParse(BASE_RESULT);
    expect(result.success).toBe(false);
  });

  it("rejects result with invalid priority value", () => {
    const result = AiAnalysisResultSchema.safeParse({
      ...BASE_RESULT,
      priority: "CRITICAL",
    });
    expect(result.success).toBe(false);
  });

  it("accepts result with priority BLOCKER", () => {
    const result = AiAnalysisResultSchema.safeParse({
      ...BASE_RESULT,
      priority: "BLOCKER",
    });
    expect(result.success).toBe(true);
  });

  it("accepts result with priority ACTIONABLE", () => {
    const result = AiAnalysisResultSchema.safeParse({
      ...BASE_RESULT,
      priority: "ACTIONABLE",
    });
    expect(result.success).toBe(true);
  });

  it("accepts result with priority FLAKY", () => {
    const result = AiAnalysisResultSchema.safeParse({
      ...BASE_RESULT,
      priority: "FLAKY",
    });
    expect(result.success).toBe(true);
  });

  it("accepts result with priority INFRA", () => {
    const result = AiAnalysisResultSchema.safeParse({
      ...BASE_RESULT,
      priority: "INFRA",
    });
    expect(result.success).toBe(true);
  });

  it("accepts result with priority UNKNOWN", () => {
    const result = AiAnalysisResultSchema.safeParse({
      ...BASE_RESULT,
      priority: "UNKNOWN",
    });
    expect(result.success).toBe(true);
  });
});

describe("PRIORITY_ORDER", () => {
  it("assigns BLOCKER the highest sort weight (4)", () => {
    expect(PRIORITY_ORDER.BLOCKER).toBe(4);
  });

  it("assigns ACTIONABLE weight 3", () => {
    expect(PRIORITY_ORDER.ACTIONABLE).toBe(3);
  });

  it("assigns FLAKY weight 2", () => {
    expect(PRIORITY_ORDER.FLAKY).toBe(2);
  });

  it("assigns INFRA weight 1", () => {
    expect(PRIORITY_ORDER.INFRA).toBe(1);
  });

  it("assigns UNKNOWN the lowest weight (0)", () => {
    expect(PRIORITY_ORDER.UNKNOWN).toBe(0);
  });
});

describe("PRIORITY_LABEL", () => {
  it("maps BLOCKER to Blocker", () => {
    expect(PRIORITY_LABEL.BLOCKER).toBe("Blocker");
  });

  it("maps ACTIONABLE to Actionable", () => {
    expect(PRIORITY_LABEL.ACTIONABLE).toBe("Actionable");
  });

  it("maps FLAKY to Flaky", () => {
    expect(PRIORITY_LABEL.FLAKY).toBe("Flaky");
  });

  it("maps INFRA to Infra", () => {
    expect(PRIORITY_LABEL.INFRA).toBe("Infra");
  });

  it("maps UNKNOWN to Unknown", () => {
    expect(PRIORITY_LABEL.UNKNOWN).toBe("Unknown");
  });
});
