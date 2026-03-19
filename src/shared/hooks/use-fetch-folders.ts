import { useQuery } from "@tanstack/react-query";
import { jenkinsGet } from "../../api/jenkins-client";
import { useConnectionStore } from "../../store/connection-store";
import type { ConnectionConfig } from "../../store/connection-store";

interface JobEntry {
  readonly name: string;
  readonly _class: string;
  readonly url: string;
  readonly color?: string;
  readonly jobs?: readonly JobEntry[];
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

interface FolderResponse {
  readonly jobs: readonly JobEntry[];
}

const JOB_FIELDS =
  "name,url,color,_class,lastBuild[number,result,timestamp,duration,estimatedDuration],healthReport[description,score]";

function isFolder(entry: JobEntry): boolean {
  return (
    entry._class.includes("Folder") ||
    entry._class.includes("OrganizationFolder") ||
    entry._class.includes("WorkflowMultiBranchProject")
  );
}

function isLeafJob(entry: JobEntry): boolean {
  return !!entry.color && !isFolder(entry);
}

export interface FlatJob {
  readonly name: string;
  readonly fullPath: string;
  readonly url: string;
  readonly color: string;
  readonly _class: string;
  readonly lastBuild?: JobEntry["lastBuild"];
  readonly healthReport?: JobEntry["healthReport"];
}

async function crawlJobs(
  baseUrl: string,
  config: ConnectionConfig,
  folderUrl: string,
  parentPath: string,
  maxDepth: number,
): Promise<FlatJob[]> {
  if (maxDepth <= 0) return [];

  const apiUrl = `${folderUrl}api/json?tree=jobs[${JOB_FIELDS}]`;
  let data: FolderResponse;
  try {
    data = await jenkinsGet<FolderResponse>(apiUrl, config);
  } catch {
    return [];
  }

  if (!data.jobs) return [];

  const results: FlatJob[] = [];
  const subCrawls: Promise<FlatJob[]>[] = [];

  for (const job of data.jobs) {
    const path = parentPath ? `${parentPath}/${job.name}` : job.name;

    if (isLeafJob(job)) {
      results.push({
        name: job.name,
        fullPath: path,
        url: job.url,
        color: job.color!,
        _class: job._class,
        lastBuild: job.lastBuild,
        healthReport: job.healthReport,
      });
    } else if (isFolder(job)) {
      const jobUrl = job.url.startsWith("http")
        ? job.url.replace(/^https?:\/\/[^/]+/, baseUrl)
        : `${baseUrl}/${job.url}`;
      const normalized = jobUrl.endsWith("/") ? jobUrl : `${jobUrl}/`;
      subCrawls.push(
        crawlJobs(baseUrl, config, normalized, path, maxDepth - 1),
      );
    }
  }

  const nested = await Promise.all(subCrawls);
  return [...results, ...nested.flat()];
}

export function useAllJobs() {
  const config = useConnectionStore((s) => s.config);

  return useQuery({
    queryKey: ["all-jobs"],
    queryFn: async () => {
      if (!config) throw new Error("No connection");
      const baseUrl = config.baseUrl.replace(/\/$/, "");
      const jobs = await crawlJobs(baseUrl, config, `${baseUrl}/`, "", 6);
      console.log(
        "All discovered jobs:",
        jobs.map((j) => ({
          name: j.name,
          fullPath: j.fullPath,
          color: j.color,
        })),
      );
      return jobs;
    },
    enabled: !!config,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
