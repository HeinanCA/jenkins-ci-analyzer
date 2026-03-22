import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";

const MAX_LOG_CHARS = 50_000;

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
- suggestedFixes must be actionable commands or specific steps, not generic advice.
- If you can identify the exact failing line, include it.
- If multiple tests failed, focus on the first/most important one.
- stackTrace should only include frames from the application code, not framework/library internals.
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

function createClient(): Anthropic | AnthropicBedrock | null {
  // Option 1: AWS Bedrock API key (simplest)
  const bedrockApiKey = process.env["AWS_BEARER_TOKEN_BEDROCK"];
  if (bedrockApiKey) {
    const awsRegion = process.env["AWS_REGION"] ?? "us-east-1";
    return new AnthropicBedrock({ awsRegion });
  }

  // Option 2: AWS Bedrock with IAM credentials
  const awsRegion =
    process.env["AWS_REGION"] ?? process.env["AWS_DEFAULT_REGION"];
  if (awsRegion && process.env["AWS_ACCESS_KEY_ID"]) {
    return new AnthropicBedrock({ awsRegion });
  }

  // Option 3: Direct Anthropic API key
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (apiKey) {
    return new Anthropic({ apiKey });
  }

  return null;
}

function getModelId(): string {
  // Bedrock uses a different model ID format
  if (process.env["AWS_REGION"] && !process.env["ANTHROPIC_API_KEY"]) {
    return (
      process.env["BEDROCK_MODEL_ID"] ??
      "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    );
  }
  return "claude-haiku-4-5-20251001";
}

export async function analyzeWithAi(
  log: string,
  jobName: string,
  buildNumber: number,
  regexClassification?: string,
): Promise<AiAnalysisResult | null> {
  const client = createClient();
  if (!client) {
    return null;
  }

  const truncatedLog =
    log.length > MAX_LOG_CHARS
      ? `[... ${log.length - MAX_LOG_CHARS} characters truncated ...]\n${log.slice(-MAX_LOG_CHARS)}`
      : log;

  const userMessage = [
    `Analyze this Jenkins build failure:`,
    `Job: ${jobName}`,
    `Build: #${buildNumber}`,
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

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonStr = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(jsonStr) as AiAnalysisResult;
    return parsed;
  } catch (error) {
    console.error(
      "AI analysis failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}
