import Bottleneck from 'bottleneck';
import { jenkinsGet } from './jenkins-client';
import type { PlainCredentials } from './credential-vault';

interface JenkinsJobEntry {
  readonly name: string;
  readonly _class: string;
  readonly url: string;
  readonly color?: string;
  readonly jobs?: readonly JenkinsJobEntry[];
  readonly lastBuild?: {
    readonly number: number;
    readonly result: string | null;
    readonly timestamp: number;
    readonly duration: number;
    readonly estimatedDuration: number;
  } | null;
  readonly healthReport?: readonly {
    readonly description: string;
    readonly score: number;
  }[];
}

interface JenkinsFolderResponse {
  readonly jobs: readonly JenkinsJobEntry[];
}

export interface DiscoveredJob {
  readonly name: string;
  readonly fullPath: string;
  readonly url: string;
  readonly color: string;
  readonly jobClass: string;
  readonly lastBuild?: JenkinsJobEntry['lastBuild'];
  readonly healthScore?: number;
}

const JOB_FIELDS =
  'name,url,color,_class,lastBuild[number,result,timestamp,duration,estimatedDuration],healthReport[description,score]';

function isFolder(entry: JenkinsJobEntry): boolean {
  return (
    entry._class.includes('Folder') ||
    entry._class.includes('OrganizationFolder') ||
    entry._class.includes('WorkflowMultiBranchProject')
  );
}

function createLimiter(maxPerSecond: number): Bottleneck {
  return new Bottleneck({
    maxConcurrent: 5,
    minTime: Math.ceil(1000 / maxPerSecond),
  });
}

async function crawlFolder(
  baseUrl: string,
  credentials: PlainCredentials,
  folderUrl: string,
  parentPath: string,
  maxDepth: number,
  limiter: Bottleneck,
): Promise<DiscoveredJob[]> {
  if (maxDepth <= 0) return [];

  const apiUrl = `${folderUrl}api/json?tree=jobs[${JOB_FIELDS}]`;

  let data: JenkinsFolderResponse;
  try {
    data = await limiter.schedule(() =>
      jenkinsGet<JenkinsFolderResponse>(apiUrl, credentials),
    );
  } catch {
    return [];
  }

  if (!data.jobs) return [];

  const results: DiscoveredJob[] = [];
  const subCrawls: Promise<DiscoveredJob[]>[] = [];

  for (const job of data.jobs) {
    const path = parentPath ? `${parentPath}/${job.name}` : job.name;

    if (job.color && !isFolder(job)) {
      results.push({
        name: job.name,
        fullPath: path,
        url: job.url,
        color: job.color,
        jobClass: job._class,
        lastBuild: job.lastBuild,
        healthScore: job.healthReport?.[0]?.score,
      });
    } else if (isFolder(job)) {
      const jobUrl = job.url.startsWith('http')
        ? job.url
        : `${baseUrl}/${job.url}`;
      const normalized = jobUrl.endsWith('/') ? jobUrl : `${jobUrl}/`;
      subCrawls.push(
        crawlFolder(baseUrl, credentials, normalized, path, maxDepth - 1, limiter),
      );
    }
  }

  const nested = await Promise.all(subCrawls);
  return [...results, ...nested.flat()];
}

export interface CrawlConfig {
  readonly maxDepth?: number;
  readonly maxRequestsPerSecond?: number;
}

export async function crawlJenkinsInstance(
  baseUrl: string,
  credentials: PlainCredentials,
  config: CrawlConfig = {},
): Promise<DiscoveredJob[]> {
  const maxDepth = config.maxDepth ?? 6;
  const maxRps = config.maxRequestsPerSecond ?? 10;
  const limiter = createLimiter(maxRps);

  const normalizedBase = baseUrl.replace(/\/$/, '');
  return crawlFolder(
    normalizedBase,
    credentials,
    `${normalizedBase}/`,
    '',
    maxDepth,
    limiter,
  );
}
