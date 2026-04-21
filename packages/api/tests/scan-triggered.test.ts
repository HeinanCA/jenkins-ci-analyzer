import { describe, it, expect } from "vitest";
import { isScanTriggered } from "../src/jobs/sync-builds";

describe("isScanTriggered", () => {
  it("returns false for empty causes", () => {
    expect(isScanTriggered([])).toBe(false);
  });

  it("returns false for a real user-triggered cause", () => {
    expect(
      isScanTriggered([
        { userName: "heinan.c", shortDescription: "Started by user Heinan" },
      ]),
    ).toBe(false);
  });

  it("returns false for SCM change cause", () => {
    expect(
      isScanTriggered([
        { shortDescription: "Started by an SCM change" },
      ]),
    ).toBe(false);
  });

  it("filters BranchIndexingCause by _class", () => {
    expect(
      isScanTriggered([
        { _class: "jenkins.branch.BranchIndexingCause" },
      ]),
    ).toBe(true);
  });

  it("filters BranchEventCause by _class", () => {
    expect(
      isScanTriggered([{ _class: "jenkins.branch.BranchEventCause" }]),
    ).toBe(true);
  });

  it("filters by shortDescription prefix 'Branch indexing'", () => {
    expect(
      isScanTriggered([{ shortDescription: "Branch indexing" }]),
    ).toBe(true);
  });

  it("filters 'Branch indexing' with suffix", () => {
    expect(
      isScanTriggered([
        { shortDescription: "Branch indexing detected changes" },
      ]),
    ).toBe(true);
  });

  it("filters by shortDescription prefix 'Branch event'", () => {
    expect(
      isScanTriggered([{ shortDescription: "Branch event" }]),
    ).toBe(true);
  });

  it("uses only the primary cause", () => {
    expect(
      isScanTriggered([
        { userName: "heinan.c", shortDescription: "Started by user Heinan" },
        { _class: "jenkins.branch.BranchIndexingCause" },
      ]),
    ).toBe(false);
  });

  it("is not fooled by unrelated descriptions", () => {
    expect(
      isScanTriggered([{ shortDescription: "Triggered by upstream" }]),
    ).toBe(false);
  });
});
