/**
 * Unit tests for failure-status.ts
 *
 * Covers: broken, in_progress, fixed, stable-omit, abort-skip, and
 *         the abort-then-success edge case.
 */
import { describe, it, expect } from "vitest";
import {
  resolveJobStatus,
  type BuildRow,
  type AnalysisRow,
  type JobMeta,
} from "../src/services/failure-status";

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE_DATE = new Date("2026-01-10T12:00:00Z");

function makeBuild(
  overrides: Partial<BuildRow> & { id: string },
): BuildRow {
  return {
    jobId: "job-1",
    organizationId: "org-1",
    buildNumber: 1,
    result: "FAILURE",
    startedAt: BASE_DATE,
    durationMs: 1000,
    gitSha: null,
    gitRemoteUrl: null,
    triggeredBy: null,
    culprits: [],
    ...overrides,
  };
}

const JOB_META: JobMeta = {
  jobId: "job-1",
  jobName: "my-service",
  jobFullPath: "team/my-service",
  jobUrl: "https://jenkins/job/my-service",
};

const NO_ANALYSES = new Map<string, AnalysisRow>();
const NO_DISMISSED = new Set<string>();

// ── broken ────────────────────────────────────────────────────────────────────

describe("resolveJobStatus — broken", () => {
  it("returns broken when latest meaningful build is FAILURE", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "FAILURE", buildNumber: 3 }),
      makeBuild({ id: "b2", result: "FAILURE", buildNumber: 2 }),
      makeBuild({ id: "b3", result: "SUCCESS", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("broken");
    expect(result!.streak).toBe(2);
    expect(result!.latestBuild.id).toBe("b1");
  });

  it("returns broken when latest meaningful build is UNSTABLE", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "UNSTABLE", buildNumber: 2 }),
      makeBuild({ id: "b2", result: "SUCCESS", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result!.status).toBe("broken");
    expect(result!.streak).toBe(1);
  });

  it("streak counts only consecutive leading failures", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "FAILURE", buildNumber: 4 }),
      makeBuild({ id: "b2", result: "FAILURE", buildNumber: 3 }),
      makeBuild({ id: "b3", result: "SUCCESS", buildNumber: 2 }),
      makeBuild({ id: "b4", result: "FAILURE", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result!.status).toBe("broken");
    expect(result!.streak).toBe(2); // only b1+b2 are consecutive at the top
  });
});

// ── in_progress ───────────────────────────────────────────────────────────────

describe("resolveJobStatus — in_progress", () => {
  it("returns in_progress when latest build is running and prior is FAILURE", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: null, buildNumber: 3 }),
      makeBuild({ id: "b2", result: "FAILURE", buildNumber: 2 }),
      makeBuild({ id: "b3", result: "SUCCESS", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result!.status).toBe("in_progress");
    expect(result!.latestBuild.id).toBe("b1");
    expect(result!.failureBuilds[0].id).toBe("b2");
  });

  it("returns null when running build follows a SUCCESS (not a failure scenario)", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: null, buildNumber: 2 }),
      makeBuild({ id: "b2", result: "SUCCESS", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result).toBeNull();
  });

  it("returns null when only build is in progress with no history", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: null, buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result).toBeNull();
  });
});

// ── fixed ─────────────────────────────────────────────────────────────────────

describe("resolveJobStatus — fixed", () => {
  it("returns fixed when latest meaningful is SUCCESS and previous was FAILURE", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "SUCCESS", buildNumber: 3 }),
      makeBuild({ id: "b2", result: "FAILURE", buildNumber: 2 }),
      makeBuild({ id: "b3", result: "FAILURE", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result!.status).toBe("fixed");
    expect(result!.recoveryBuildId).toBe("b1");
    expect(result!.latestBuild.id).toBe("b1");
    expect(result!.failureBuilds.length).toBe(2);
  });

  it("returns null (dismissed) when recovery buildId is in dismissedSet", () => {
    const dismissed = new Set(["b1"]);
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "SUCCESS", buildNumber: 2 }),
      makeBuild({ id: "b2", result: "FAILURE", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, dismissed);
    expect(result).toBeNull();
  });

  it("still returns fixed when a different build is dismissed", () => {
    const dismissed = new Set(["b2"]); // dismissing a failure build, not the recovery
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "SUCCESS", buildNumber: 2 }),
      makeBuild({ id: "b2", result: "FAILURE", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, dismissed);
    expect(result!.status).toBe("fixed");
  });
});

// ── stable — omit ─────────────────────────────────────────────────────────────

describe("resolveJobStatus — stable omit", () => {
  it("returns null when latest two meaningful builds are both SUCCESS", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "SUCCESS", buildNumber: 2 }),
      makeBuild({ id: "b2", result: "SUCCESS", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result).toBeNull();
  });

  it("returns null when only build is SUCCESS", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "SUCCESS", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result).toBeNull();
  });

  it("returns null when no builds", () => {
    const result = resolveJobStatus(JOB_META, [], NO_ANALYSES, NO_DISMISSED);
    expect(result).toBeNull();
  });
});

// ── abort-skip ────────────────────────────────────────────────────────────────

describe("resolveJobStatus — abort-skip", () => {
  it("skips ABORTED builds when finding latest meaningful", () => {
    // b1 is ABORTED — should be skipped. b2 is FAILURE = broken.
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "ABORTED", buildNumber: 3 }),
      makeBuild({ id: "b2", result: "FAILURE", buildNumber: 2 }),
      makeBuild({ id: "b3", result: "SUCCESS", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result!.status).toBe("broken");
    expect(result!.latestBuild.id).toBe("b2");
  });

  it("skips multiple consecutive ABORTs before a SUCCESS → fixed", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "ABORTED", buildNumber: 5 }),
      makeBuild({ id: "b2", result: "ABORTED", buildNumber: 4 }),
      makeBuild({ id: "b3", result: "SUCCESS", buildNumber: 3 }),
      makeBuild({ id: "b4", result: "FAILURE", buildNumber: 2 }),
      makeBuild({ id: "b5", result: "FAILURE", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result!.status).toBe("fixed");
    expect(result!.recoveryBuildId).toBe("b3");
    expect(result!.failureBuilds.length).toBe(2);
  });

  it("skips ABORTs between failures — still broken", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "ABORTED", buildNumber: 4 }),
      makeBuild({ id: "b2", result: "FAILURE", buildNumber: 3 }),
      makeBuild({ id: "b3", result: "ABORTED", buildNumber: 2 }),
      makeBuild({ id: "b4", result: "FAILURE", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result!.status).toBe("broken");
  });

  it("returns null when all builds are ABORTED (all skipped → no meaningful)", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "ABORTED", buildNumber: 2 }),
      makeBuild({ id: "b2", result: "ABORTED", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result).toBeNull();
  });

  it("in_progress after aborts with prior failure → in_progress", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: null, buildNumber: 4 }),
      makeBuild({ id: "b2", result: "ABORTED", buildNumber: 3 }),
      makeBuild({ id: "b3", result: "FAILURE", buildNumber: 2 }),
      makeBuild({ id: "b4", result: "SUCCESS", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result!.status).toBe("in_progress");
  });

  it("aborts followed by stable SUCCESSes → null (omit)", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "ABORTED", buildNumber: 4 }),
      makeBuild({ id: "b2", result: "SUCCESS", buildNumber: 3 }),
      makeBuild({ id: "b3", result: "SUCCESS", buildNumber: 2 }),
      makeBuild({ id: "b4", result: "FAILURE", buildNumber: 1 }),
    ];
    // Latest meaningful = SUCCESS (b2). Before it = SUCCESS (b3). Stable → omit.
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result).toBeNull();
  });

  // Edge: single abort + prior FAILURE → broken (abort skipped, FAILURE is latest meaningful)
  it("single abort before a failure → broken (abort skipped)", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "ABORTED", buildNumber: 2 }),
      makeBuild({ id: "b2", result: "FAILURE", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, NO_DISMISSED);
    expect(result!.status).toBe("broken");
    expect(result!.latestBuild.id).toBe("b2");
  });
});

// ── analysis noise propagation ────────────────────────────────────────────────

describe("resolveJobStatus — analysis noise", () => {
  it("attaches logNoisePercent from the latest failure build's analysis", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "b1", result: "FAILURE", buildNumber: 2 }),
      makeBuild({ id: "b2", result: "SUCCESS", buildNumber: 1 }),
    ];
    const analysisMap = new Map<string, AnalysisRow>([
      [
        "b1",
        {
          id: "a1",
          buildId: "b1",
          classification: "infrastructure",
          confidence: 0.9,
          matches: [],
          aiSummary: null,
          aiRootCause: null,
          aiSuggestedFixes: null,
          logNoisePercent: 42,
          logTopNoise: "GC overhead",
        },
      ],
    ]);
    const result = resolveJobStatus(JOB_META, builds, analysisMap, NO_DISMISSED);
    expect(result!.logNoisePercent).toBe(42);
    expect(result!.logTopNoise).toBe("GC overhead");
  });
});

// ── views (dismissal) contract ────────────────────────────────────────────────

describe("dismissal contract", () => {
  it("fixed card is visible when recovery buildId not in dismissed set", () => {
    const builds: BuildRow[] = [
      makeBuild({ id: "recovery-build", result: "SUCCESS", buildNumber: 2 }),
      makeBuild({ id: "failure-build", result: "FAILURE", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(
      JOB_META,
      builds,
      NO_ANALYSES,
      new Set(), // empty dismissed set
    );
    expect(result!.status).toBe("fixed");
    expect(result!.recoveryBuildId).toBe("recovery-build");
  });

  it("fixed card is hidden after POST /failures/views dismisses the recovery build", () => {
    const dismissed = new Set(["recovery-build"]);
    const builds: BuildRow[] = [
      makeBuild({ id: "recovery-build", result: "SUCCESS", buildNumber: 2 }),
      makeBuild({ id: "failure-build", result: "FAILURE", buildNumber: 1 }),
    ];
    const result = resolveJobStatus(JOB_META, builds, NO_ANALYSES, dismissed);
    expect(result).toBeNull();
  });
});
