import { describe, it, expect } from "vitest";
import { extractUserIdFromUrl } from "../src/jobs/sync-builds";

// ─── extractUserIdFromUrl ────────────────────────────────────────────────────

describe("extractUserIdFromUrl", () => {
  it("extracts userId from a standard Jenkins user URL", () => {
    expect(
      extractUserIdFromUrl("https://jenkins.neteera.com/user/cosmin.stoian"),
    ).toBe("cosmin.stoian");
  });

  it("handles trailing slash", () => {
    expect(
      extractUserIdFromUrl("https://jenkins.neteera.com/user/cosmin.stoian/"),
    ).toBe("cosmin.stoian");
  });

  it("decodes percent-encoded userId", () => {
    expect(
      extractUserIdFromUrl(
        "https://jenkins.neteera.com/user/first%20last",
      ),
    ).toBe("first last");
  });

  it("decodes dot-delimited userId that needs no decoding", () => {
    expect(
      extractUserIdFromUrl("https://jenkins.neteera.com/user/john.doe"),
    ).toBe("john.doe");
  });

  it("returns null for undefined input", () => {
    expect(extractUserIdFromUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractUserIdFromUrl("")).toBeNull();
  });

  it("returns null for URL without /user/ segment", () => {
    expect(
      extractUserIdFromUrl("https://jenkins.neteera.com/job/my-pipeline"),
    ).toBeNull();
  });

  it("returns null when /user/ segment has no id after it", () => {
    expect(
      extractUserIdFromUrl("https://jenkins.neteera.com/user/"),
    ).toBeNull();
  });

  it("handles deep URL paths where /user/ appears in middle", () => {
    // Jenkins canonical user URL always ends with /user/<id>
    expect(
      extractUserIdFromUrl(
        "https://jenkins.neteera.com/user/alice.smith",
      ),
    ).toBe("alice.smith");
  });

  it("handles userId with special chars that are URL-safe", () => {
    expect(
      extractUserIdFromUrl("https://jenkins.neteera.com/user/user_123-test"),
    ).toBe("user_123-test");
  });
});

// ─── culprits array extraction ───────────────────────────────────────────────

describe("culprit extraction from build.culprits array", () => {
  function extractCulpritIds(
    culprits: readonly { absoluteUrl?: string; fullName?: string }[],
  ): string[] {
    return culprits
      .map((c) => extractUserIdFromUrl(c.absoluteUrl))
      .filter((id): id is string => id !== null);
  }

  it("returns empty array for empty culprits", () => {
    expect(extractCulpritIds([])).toEqual([]);
  });

  it("extracts userId from single culprit", () => {
    expect(
      extractCulpritIds([
        { absoluteUrl: "https://jenkins.neteera.com/user/alice", fullName: "Alice" },
      ]),
    ).toEqual(["alice"]);
  });

  it("extracts userIds from multiple culprits", () => {
    expect(
      extractCulpritIds([
        { absoluteUrl: "https://jenkins.neteera.com/user/alice", fullName: "Alice" },
        { absoluteUrl: "https://jenkins.neteera.com/user/bob", fullName: "Bob" },
      ]),
    ).toEqual(["alice", "bob"]);
  });

  it("skips culprit with missing absoluteUrl", () => {
    expect(
      extractCulpritIds([
        { fullName: "Alice" },
        { absoluteUrl: "https://jenkins.neteera.com/user/bob", fullName: "Bob" },
      ]),
    ).toEqual(["bob"]);
  });

  it("skips culprit with absoluteUrl that has no /user/ segment", () => {
    expect(
      extractCulpritIds([
        { absoluteUrl: "https://jenkins.neteera.com/job/pipeline" },
        { absoluteUrl: "https://jenkins.neteera.com/user/valid" },
      ]),
    ).toEqual(["valid"]);
  });

  it("decodes percent-encoded culprit userId", () => {
    expect(
      extractCulpritIds([
        {
          absoluteUrl: "https://jenkins.neteera.com/user/first%20last",
          fullName: "First Last",
        },
      ]),
    ).toEqual(["first last"]);
  });
});
