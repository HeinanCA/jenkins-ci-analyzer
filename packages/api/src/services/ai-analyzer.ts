import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";

const MAX_LOG_CHARS = 120_000;
const HEAD_CHARS = 20_000;
const TAIL_CHARS = 100_000;

// Haiku pricing per 1M tokens
const INPUT_COST_PER_MTOK = 0.8;
const OUTPUT_COST_PER_MTOK = 4.0;

const SYSTEM_PROMPT = `You are PulsCI, a CI/CD build failure diagnostics engine. You analyze Jenkins build logs and explain failures in plain English for developers who don't understand CI infrastructure.

Your job: read the build log, identify exactly what went wrong, and tell the developer what to do about it.

Respond in JSON with this exact structure:
{
  "summary": "One sentence plain-English summary of what happened",
  "classification": "code" or "infrastructure",
  "rootCause": "The specific technical root cause",
  "failingTest": "Full test class and method name, if a test failed. null otherwise",
  "assertion": "The assertion message with expected vs actual values, if available. null otherwise",
  "filePath": "The source file where the error originated, if identifiable. null otherwise",
  "lineNumber": number or null,
  "exceptionType": "The exception class name, if applicable. null otherwise",
  "stackTrace": ["Top 3 relevant app-code stack frames, excluding framework internals"],
  "suggestedFixes": ["Step 1", "Step 2", "Step 3"],
  "confidence": 0.0 to 1.0
}

Rules:
- Be SPECIFIC. Never say "a test failed" — say WHICH test, WHAT assertion, WHAT values.
- classification "infrastructure" = agent issues, disk, network, timeout, Docker. Developer can't fix it.
- classification "code" = test failure, compilation, dependency, lint. Developer CAN fix it.
- suggestedFixes[0] MUST be a runnable terminal command when possible (e.g., "mvn test -pl alert-service -Dtest=AttentionAlertTest#produceAttentionAlert_ShouldSaveToDatabase", "npm ci", "npx tsc --noEmit"). Developers will copy-paste this.
- suggestedFixes[1+] can be explanatory steps.
- If you can identify the exact failing line, include it.
- If multiple tests failed, focus on the first/most important one.
- ALWAYS include filePath and lineNumber if they appear anywhere in the log. Developers need to know WHERE to look.
- stackTrace should only include frames from the application code, not framework/library internals.
- CRITICAL: Find the ROOT CAUSE, not the last error. Build logs often have cascading failures. A test failure causes JaCoCo/coverage to fail, which causes the build to fail. The test failure is the root cause, NOT the coverage error. Look for AssertionError, AssertionFailedError, test failures BEFORE looking at post-build errors like coverage, reporting, or publishing steps.
- Post-build errors (JaCoCo, Surefire report, coverage publish, artifact upload) are SYMPTOMS, not causes. Always trace back to the original failure.
- Respond ONLY with JSON. No markdown, no explanation outside the JSON.`;

export interface AiAnalysisResult {
  readonly summary: string;
  readonly classification: "code" | "infrastructure";
  readonly rootCause: string;
  readonly failingTest: string | null;
  readonly assertion: string | null;
  readonly filePath: string | null;
  readonly lineNumber: number | null;
  readonly exceptionType: string | null;
  readonly stackTrace: readonly string[];
  readonly suggestedFixes: readonly string[];
  readonly confidence: number;
}

export interface AiUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
}

export interface AiAnalysisResponse {
  readonly result: AiAnalysisResult | null;
  readonly usage: AiUsage | null;
}

function createClient(): Anthropic | AnthropicBedrock | null {
  const bedrockApiKey = process.env["AWS_BEARER_TOKEN_BEDROCK"];
  if (bedrockApiKey) {
    const awsRegion = process.env["AWS_REGION"] ?? "us-east-1";
    return new AnthropicBedrock({ awsRegion });
  }

  const awsRegion =
    process.env["AWS_REGION"] ?? process.env["AWS_DEFAULT_REGION"];
  if (awsRegion && process.env["AWS_ACCESS_KEY_ID"]) {
    return new AnthropicBedrock({ awsRegion });
  }

  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (apiKey) {
    return new Anthropic({ apiKey });
  }

  return null;
}

function getModelId(): string {
  if (process.env["AWS_REGION"] && !process.env["ANTHROPIC_API_KEY"]) {
    return (
      process.env["BEDROCK_MODEL_ID"] ??
      "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    );
  }
  return "claude-haiku-4-5-20251001";
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK
  );
}

function detectBuildContext(jobPath: string): string | null {
  const lower = jobPath.toLowerCase();
  if (
    lower.includes("web-modern") ||
    lower.includes("frontend") ||
    lower.includes("/web/")
  ) {
    return "React/TypeScript, Create React App (react-app-rewired), Webpack, npm, ESLint, Jest";
  }
  if (lower.includes("neteera-backend") || lower.includes("/service/")) {
    return "Java/Spring Boot, Maven multi-module, JUnit 5, Flyway migrations, Docker";
  }
  if (lower.includes("libraries") || lower.includes("-lib")) {
    return "Java library, Maven, JUnit 5, deployed to internal Artifactory";
  }
  if (lower.includes("automation")) {
    return "Test automation, Python or Java, may use Selenium/API testing";
  }
  return null;
}

export async function analyzeWithAi(
  log: string,
  jobName: string,
  buildNumber: number,
  regexClassification?: string,
): Promise<AiAnalysisResponse> {
  const client = createClient();
  if (!client) {
    return { result: null, usage: null };
  }

  const truncatedLog =
    log.length > MAX_LOG_CHARS
      ? `${log.slice(0, HEAD_CHARS)}\n\n[... ${log.length - HEAD_CHARS - TAIL_CHARS} characters truncated — test failures may appear above, build errors below ...]\n\n${log.slice(-TAIL_CHARS)}`
      : log;

  const buildContext = detectBuildContext(jobName);

  const userMessage = [
    `Analyze this Jenkins build failure:`,
    `Job: ${jobName}`,
    `Build: #${buildNumber}`,
    buildContext ? `Build stack: ${buildContext}` : "",
    regexClassification
      ? `Regex pre-classification: ${regexClassification}`
      : "",
    ``,
    `Build log:`,
    `\`\`\``,
    truncatedLog,
    `\`\`\``,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: getModelId(),
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const costUsd = calculateCost(inputTokens, outputTokens);

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonStr = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(jsonStr) as AiAnalysisResult;
    return {
      result: parsed,
      usage: { inputTokens, outputTokens, costUsd },
    };
  } catch (error) {
    console.error(
      "AI analysis failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return { result: null, usage: null };
  }
}
