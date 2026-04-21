import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules before importing
vi.mock("../src/db/connection", () => ({
  db: {
    select: vi.fn(),
    selectDistinct: vi.fn(),
  },
}));

vi.mock("../src/services/credential-vault", () => ({
  decryptCredentials: vi.fn(() => ({
    username: "admin",
    token: "decrypted-token",
  })),
}));

vi.mock("../src/services/jenkins-user-cache", () => ({
  isCacheFresh: vi.fn(),
  fetchAndCacheUser: vi.fn(),
}));

// Import after mocks
import { db } from "../src/db/connection";
import { backfillJenkinsUsers } from "../src/jobs/backfill-jenkins-users";
import { isCacheFresh, fetchAndCacheUser } from "../src/services/jenkins-user-cache";

const mockedDb = vi.mocked(db);
const mockedIsCacheFresh = vi.mocked(isCacheFresh);
const mockedFetchAndCacheUser = vi.mocked(fetchAndCacheUser);

function createMockHelpers() {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    addJob: vi.fn(),
    job: {} as never,
    withPgClient: vi.fn(),
  } as unknown as Parameters<typeof backfillJenkinsUsers>[1];
}

describe("backfillJenkinsUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aborts when organizationId is missing", async () => {
    const helpers = createMockHelpers();

    await backfillJenkinsUsers(
      { instanceId: "inst-1", organizationId: "" },
      helpers,
    );

    expect(helpers.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("missing organizationId"),
    );
  });

  it("aborts when instance is not found", async () => {
    const helpers = createMockHelpers();

    // Mock: instance query returns empty
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockedDb.select.mockReturnValue({ from: mockFrom } as never);

    await backfillJenkinsUsers(
      { instanceId: "missing-inst", organizationId: "org-1" },
      helpers,
    );

    expect(helpers.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("not found"),
    );
  });

  it("logs info and returns when no triggered_by users found", async () => {
    const helpers = createMockHelpers();

    // Mock: instance query returns a row
    const mockLimit = vi.fn().mockResolvedValue([
      {
        baseUrl: "https://jenkins.test",
        credentials: {
          username: "admin",
          tokenEncrypted: "enc",
          tokenIv: "iv",
          tokenTag: "tag",
        },
      },
    ]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockedDb.select.mockReturnValue({ from: mockFrom } as never);

    // Mock: selectDistinct returns empty
    const mockDistinctWhere = vi.fn().mockResolvedValue([]);
    const mockDistinctInnerJoin = vi
      .fn()
      .mockReturnValue({ where: mockDistinctWhere });
    const mockDistinctFrom = vi
      .fn()
      .mockReturnValue({ innerJoin: mockDistinctInnerJoin });
    mockedDb.selectDistinct.mockReturnValue({
      from: mockDistinctFrom,
    } as never);

    await backfillJenkinsUsers(
      { instanceId: "inst-1", organizationId: "org-1" },
      helpers,
    );

    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("no triggered_by users"),
    );
  });

  it("skips users with fresh cache entries", async () => {
    const helpers = createMockHelpers();

    // Mock: instance query
    const mockLimit = vi.fn().mockResolvedValue([
      {
        baseUrl: "https://jenkins.test",
        credentials: {
          username: "admin",
          tokenEncrypted: "enc",
          tokenIv: "iv",
          tokenTag: "tag",
        },
      },
    ]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockedDb.select.mockReturnValue({ from: mockFrom } as never);

    // Mock: selectDistinct returns users
    const mockDistinctWhere = vi
      .fn()
      .mockResolvedValue([
        { triggeredBy: "user1" },
        { triggeredBy: "user2" },
      ]);
    const mockDistinctInnerJoin = vi
      .fn()
      .mockReturnValue({ where: mockDistinctWhere });
    const mockDistinctFrom = vi
      .fn()
      .mockReturnValue({ innerJoin: mockDistinctInnerJoin });
    mockedDb.selectDistinct.mockReturnValue({
      from: mockDistinctFrom,
    } as never);

    // user1 is fresh, user2 is stale
    mockedIsCacheFresh
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mockedFetchAndCacheUser.mockResolvedValue(undefined);

    await backfillJenkinsUsers(
      { instanceId: "inst-1", organizationId: "org-1" },
      helpers,
    );

    // Only user2 should be fetched
    expect(mockedFetchAndCacheUser).toHaveBeenCalledTimes(1);
    expect(mockedFetchAndCacheUser).toHaveBeenCalledWith(
      expect.objectContaining({
        ciInstanceId: "inst-1",
        organizationId: "org-1",
      }),
      "user2",
    );

    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("1 cached"),
    );
    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("1 skipped"),
    );
  });

  it("handles fetch failures gracefully and continues", async () => {
    const helpers = createMockHelpers();

    // Mock: instance query
    const mockLimit = vi.fn().mockResolvedValue([
      {
        baseUrl: "https://jenkins.test",
        credentials: {
          username: "admin",
          tokenEncrypted: "enc",
          tokenIv: "iv",
          tokenTag: "tag",
        },
      },
    ]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockedDb.select.mockReturnValue({ from: mockFrom } as never);

    // Mock: selectDistinct returns users
    const mockDistinctWhere = vi
      .fn()
      .mockResolvedValue([
        { triggeredBy: "good.user" },
        { triggeredBy: "bad.user" },
      ]);
    const mockDistinctInnerJoin = vi
      .fn()
      .mockReturnValue({ where: mockDistinctWhere });
    const mockDistinctFrom = vi
      .fn()
      .mockReturnValue({ innerJoin: mockDistinctInnerJoin });
    mockedDb.selectDistinct.mockReturnValue({
      from: mockDistinctFrom,
    } as never);

    mockedIsCacheFresh.mockResolvedValue(false);
    mockedFetchAndCacheUser
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom"));

    await backfillJenkinsUsers(
      { instanceId: "inst-1", organizationId: "org-1" },
      helpers,
    );

    expect(helpers.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("bad.user"),
    );
    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("1 cached"),
    );
    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("1 failed"),
    );
  });

  it("is idempotent — fresh entries are skipped on re-run", async () => {
    const helpers = createMockHelpers();

    // Mock: instance query
    const mockLimit = vi.fn().mockResolvedValue([
      {
        baseUrl: "https://jenkins.test",
        credentials: {
          username: "admin",
          tokenEncrypted: "enc",
          tokenIv: "iv",
          tokenTag: "tag",
        },
      },
    ]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockedDb.select.mockReturnValue({ from: mockFrom } as never);

    // Mock: selectDistinct
    const mockDistinctWhere = vi
      .fn()
      .mockResolvedValue([{ triggeredBy: "user1" }]);
    const mockDistinctInnerJoin = vi
      .fn()
      .mockReturnValue({ where: mockDistinctWhere });
    const mockDistinctFrom = vi
      .fn()
      .mockReturnValue({ innerJoin: mockDistinctInnerJoin });
    mockedDb.selectDistinct.mockReturnValue({
      from: mockDistinctFrom,
    } as never);

    // All fresh — simulates a re-run
    mockedIsCacheFresh.mockResolvedValue(true);

    await backfillJenkinsUsers(
      { instanceId: "inst-1", organizationId: "org-1" },
      helpers,
    );

    expect(mockedFetchAndCacheUser).not.toHaveBeenCalled();
    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("0 cached"),
    );
    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("1 skipped"),
    );
  });
});
