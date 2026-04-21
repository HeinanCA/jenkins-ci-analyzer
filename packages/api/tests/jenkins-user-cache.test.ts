import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock jenkins-client before importing the module under test
vi.mock("../src/services/jenkins-client", () => ({
  jenkinsGet: vi.fn(),
  JenkinsApiError: class JenkinsApiError extends Error {
    readonly statusCode: number;
    readonly userMessage: string;
    constructor(message: string, statusCode: number, userMessage: string) {
      super(message);
      this.name = "JenkinsApiError";
      this.statusCode = statusCode;
      this.userMessage = userMessage;
    }
  },
}));

// Mock db/schema to return chainable query builders
const mockInsertValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectLimit = vi.fn();

const mockDb = {
  select: vi.fn(() => ({
    from: mockSelectFrom,
  })),
  insert: vi.fn(() => ({
    values: mockInsertValues,
  })),
};

vi.mock("../src/db/schema", () => ({
  jenkinsUsers: {
    ciInstanceId: "ci_instance_id",
    jenkinsUserId: "jenkins_user_id",
    fetchedAt: "fetched_at",
    email: "email",
    displayName: "display_name",
    organizationId: "organization_id",
  },
}));

import { jenkinsGet, JenkinsApiError } from "../src/services/jenkins-client";
import {
  isCacheFresh,
  fetchAndCacheUser,
  type JenkinsUserCacheDeps,
} from "../src/services/jenkins-user-cache";
import type { Database } from "../src/db/connection";

const mockedJenkinsGet = vi.mocked(jenkinsGet);

function createMockDeps(
  overrides: Partial<JenkinsUserCacheDeps> = {},
): JenkinsUserCacheDeps {
  return {
    db: mockDb as unknown as Database,
    baseUrl: "https://jenkins.example.com",
    credentials: { username: "admin", token: "secret" },
    ciInstanceId: "inst-uuid-1",
    organizationId: "org-uuid-1",
    logger: { warn: vi.fn() },
    ...overrides,
  };
}

describe("isCacheFresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup chain: select -> from -> where -> limit -> resolves
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  });

  it("returns true when a recent row exists", async () => {
    mockSelectLimit.mockResolvedValue([
      { fetchedAt: new Date() },
    ]);

    const result = await isCacheFresh(
      mockDb as unknown as Database,
      "inst-uuid-1",
      "heinan.c",
    );

    expect(result).toBe(true);
  });

  it("returns false when no matching row exists", async () => {
    mockSelectLimit.mockResolvedValue([]);

    const result = await isCacheFresh(
      mockDb as unknown as Database,
      "inst-uuid-1",
      "heinan.c",
    );

    expect(result).toBe(false);
  });
});

describe("fetchAndCacheUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate.mockResolvedValue(undefined),
    });
  });

  it("fetches user from Jenkins API and upserts into cache", async () => {
    mockedJenkinsGet.mockResolvedValue({
      fullName: "Heinan Landa",
      property: [
        {
          _class: "hudson.tasks.Mailer$UserProperty",
          address: "heinan@tig.dev",
        },
      ],
    });

    const deps = createMockDeps();
    await fetchAndCacheUser(deps, "heinan.c");

    expect(mockedJenkinsGet).toHaveBeenCalledWith(
      "https://jenkins.example.com/user/heinan.c/api/json?tree=fullName,property[address]",
      deps.credentials,
    );
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        ciInstanceId: "inst-uuid-1",
        jenkinsUserId: "heinan.c",
        email: "heinan@tig.dev",
        displayName: "Heinan Landa",
        organizationId: "org-uuid-1",
      }),
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("upserts with null email/displayName on 403 error", async () => {
    const ApiError = JenkinsApiError as unknown as new (
      msg: string,
      code: number,
      user: string,
    ) => Error & { statusCode: number };
    mockedJenkinsGet.mockRejectedValue(
      new ApiError("Forbidden", 403, "Forbidden"),
    );

    const deps = createMockDeps();
    await fetchAndCacheUser(deps, "restricted.user");

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        jenkinsUserId: "restricted.user",
        email: null,
        displayName: null,
      }),
    );
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("HTTP 403"),
    );
  });

  it("upserts with null email/displayName on 404 error", async () => {
    const ApiError = JenkinsApiError as unknown as new (
      msg: string,
      code: number,
      user: string,
    ) => Error & { statusCode: number };
    mockedJenkinsGet.mockRejectedValue(
      new ApiError("Not Found", 404, "Not Found"),
    );

    const deps = createMockDeps();
    await fetchAndCacheUser(deps, "deleted.user");

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        jenkinsUserId: "deleted.user",
        email: null,
        displayName: null,
      }),
    );
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("HTTP 404"),
    );
  });

  it("upserts with null on network error", async () => {
    mockedJenkinsGet.mockRejectedValue(new TypeError("fetch failed"));

    const deps = createMockDeps();
    await fetchAndCacheUser(deps, "network.fail");

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        jenkinsUserId: "network.fail",
        email: null,
        displayName: null,
      }),
    );
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("network error"),
    );
  });

  it("URL-encodes the userId in the API request", async () => {
    mockedJenkinsGet.mockResolvedValue({
      fullName: "Special User",
      property: [],
    });

    const deps = createMockDeps();
    await fetchAndCacheUser(deps, "user with spaces");

    expect(mockedJenkinsGet).toHaveBeenCalledWith(
      expect.stringContaining("/user/user%20with%20spaces/api/json"),
      deps.credentials,
    );
  });

  it("strips trailing slash from baseUrl", async () => {
    mockedJenkinsGet.mockResolvedValue({
      fullName: "User",
      property: [],
    });

    const deps = createMockDeps({ baseUrl: "https://jenkins.example.com/" });
    await fetchAndCacheUser(deps, "user1");

    expect(mockedJenkinsGet).toHaveBeenCalledWith(
      "https://jenkins.example.com/user/user1/api/json?tree=fullName,property[address]",
      deps.credentials,
    );
  });
});
