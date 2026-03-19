export interface HealthMetrics {
  readonly controllerReachable: boolean;
  readonly agentsOnline: number;
  readonly agentsTotal: number;
  readonly executorsBusy: number;
  readonly executorsTotal: number;
  readonly queueDepth: number;
  readonly stuckBuilds: number;
}

export type HealthLevel = "healthy" | "degraded" | "unhealthy" | "down";

export interface HealthReport {
  readonly level: HealthLevel;
  readonly score: number;
  readonly issues: readonly string[];
}

export function calculateHealth(metrics: HealthMetrics): HealthReport {
  if (!metrics.controllerReachable) {
    return {
      level: "down",
      score: 0,
      issues: ["Jenkins controller is unreachable."],
    };
  }

  const issues: string[] = [];
  let score = 100;

  if (metrics.agentsTotal === 0) {
    issues.push("No agents configured.");
    score -= 30;
  } else {
    const offlineRatio =
      (metrics.agentsTotal - metrics.agentsOnline) / metrics.agentsTotal;
    if (offlineRatio > 0.5) {
      issues.push(
        `${metrics.agentsTotal - metrics.agentsOnline} of ${metrics.agentsTotal} agents are offline.`,
      );
      score -= 60;
    } else if (offlineRatio > 0) {
      issues.push(
        `${metrics.agentsTotal - metrics.agentsOnline} agent(s) offline.`,
      );
      score -= offlineRatio * 40;
    }
  }

  if (metrics.stuckBuilds > 0) {
    issues.push(`${metrics.stuckBuilds} stuck build(s) detected.`);
    score -= 25;
  }

  if (
    metrics.executorsTotal > 0 &&
    metrics.queueDepth > metrics.executorsTotal * 2
  ) {
    issues.push(
      `Build queue is backed up: ${metrics.queueDepth} items waiting (${metrics.executorsTotal} executors available).`,
    );
    score -= 25;
  }

  score = Math.max(0, Math.round(score));

  let level: HealthLevel;
  if (score >= 80) {
    level = "healthy";
  } else if (score >= 50) {
    level = "degraded";
  } else {
    level = "unhealthy";
  }

  return { level, score, issues };
}
