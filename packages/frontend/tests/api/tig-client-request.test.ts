import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tigMe } from "../../src/api/tig-client";

// Builds a minimal fetch Response-like stub.
function makeResponse(opts: {
  status?: number;
  contentType?: string;
  body: string;
}) {
  const status = opts.status ?? 200;
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => (k === "content-type" ? opts.contentType ?? null : null) },
    json: async () => JSON.parse(opts.body),
    text: async () => opts.body,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request() success-path guard", () => {
  it("throws a clean TigApiError (not SyntaxError) when a 2xx returns HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeResponse({
          status: 200,
          contentType: "text/html",
          body: "<html> <head><title>502 Bad Gateway</title></head></html>",
        }),
      ),
    );

    await expect(tigMe.get()).rejects.toMatchObject({
      name: "TigApiError",
      message: "Server unavailable",
    });
    // Must NOT be a raw JSON parse SyntaxError.
    await expect(tigMe.get()).rejects.not.toThrow(SyntaxError);
  });

  it("throws TigApiError when content-type is JSON but body is unparseable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeResponse({
          status: 200,
          contentType: "application/json",
          body: "<html>not json</html>",
        }),
      ),
    );

    await expect(tigMe.get()).rejects.toMatchObject({
      name: "TigApiError",
      message: "Server unavailable",
    });
  });

  it("returns unwrapped data on a valid JSON 2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeResponse({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { id: "u1", email: "a@b.c", displayName: "A", role: "user" }, error: null }),
        }),
      ),
    );

    await expect(tigMe.get()).resolves.toMatchObject({ id: "u1" });
  });
});
