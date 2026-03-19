import { describe, it, expect } from 'vitest';
import {
  calculateHealth,
  type HealthMetrics,
} from '../../src/features/health/utils/health-calculator';

const HEALTHY_METRICS: HealthMetrics = {
  controllerReachable: true,
  agentsOnline: 4,
  agentsTotal: 4,
  executorsBusy: 2,
  executorsTotal: 8,
  queueDepth: 1,
  stuckBuilds: 0,
};

describe('calculateHealth', () => {
  it('returns "down" when controller is unreachable', () => {
    const result = calculateHealth({
      ...HEALTHY_METRICS,
      controllerReachable: false,
    });
    expect(result.level).toBe('down');
    expect(result.score).toBe(0);
  });

  it('returns "healthy" when everything is fine', () => {
    const result = calculateHealth(HEALTHY_METRICS);
    expect(result.level).toBe('healthy');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.issues).toHaveLength(0);
  });

  it('returns "unhealthy" when >50% agents offline', () => {
    const result = calculateHealth({
      ...HEALTHY_METRICS,
      agentsOnline: 1,
      agentsTotal: 4,
    });
    expect(result.level).toBe('unhealthy');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('returns "degraded" when stuck builds exist', () => {
    const result = calculateHealth({
      ...HEALTHY_METRICS,
      stuckBuilds: 2,
    });
    expect(result.level).toBe('degraded');
    expect(result.issues.some((i) => i.includes('stuck'))).toBe(true);
  });

  it('returns "degraded" when queue is heavily backed up', () => {
    const result = calculateHealth({
      ...HEALTHY_METRICS,
      queueDepth: 20,
      executorsTotal: 4,
    });
    expect(result.level).toBe('degraded');
    expect(result.issues.some((i) => i.includes('queue'))).toBe(true);
  });

  it('handles zero agents gracefully', () => {
    const result = calculateHealth({
      ...HEALTHY_METRICS,
      agentsOnline: 0,
      agentsTotal: 0,
      executorsTotal: 0,
    });
    expect(result.issues.some((i) => i.includes('No agents'))).toBe(true);
  });

  it('score is always between 0 and 100', () => {
    const worst = calculateHealth({
      controllerReachable: true,
      agentsOnline: 0,
      agentsTotal: 10,
      executorsBusy: 0,
      executorsTotal: 20,
      queueDepth: 100,
      stuckBuilds: 5,
    });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });
});
