function normalize(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function folderPath(folder: string): string {
  if (folder.includes('/job/')) {
    return `/job/${folder}`;
  }
  return `/job/${encodeURIComponent(folder)}`;
}

export function jobsUrl(baseUrl: string, folder?: string): string {
  const base = normalize(baseUrl);
  const path = folder ? `${folderPath(folder)}/api/json` : '/api/json';
  return `${base}${path}?tree=jobs[name,url,color,_class,lastBuild[number,result,timestamp,duration,estimatedDuration],lastSuccessfulBuild[number,timestamp],lastFailedBuild[number,timestamp],healthReport[description,score]]`;
}

export function buildHistoryUrl(
  baseUrl: string,
  folder: string,
  jobName: string,
  count = 25,
): string {
  const base = normalize(baseUrl);
  return `${base}${folderPath(folder)}/job/${encodeURIComponent(jobName)}/api/json?tree=builds[number,result,timestamp,duration,estimatedDuration]{0,${count}}`;
}

export function buildLogUrl(
  baseUrl: string,
  folder: string,
  jobName: string,
  buildNumber: number,
): string {
  const base = normalize(baseUrl);
  return `${base}${folderPath(folder)}/job/${encodeURIComponent(jobName)}/${buildNumber}/consoleText`;
}

export function agentsUrl(baseUrl: string): string {
  const base = normalize(baseUrl);
  return `${base}/computer/api/json?tree=computer[displayName,description,idle,offline,temporarilyOffline,offlineCauseReason,numExecutors,executors[currentExecutable[url,fullDisplayName,timestamp,duration,estimatedDuration]],monitorData[*]]`;
}

export function queueUrl(baseUrl: string): string {
  const base = normalize(baseUrl);
  return `${base}/queue/api/json?tree=items[id,task[name,url],inQueueSince,why,stuck,buildableStartMilliseconds]`;
}

export function testConnectionUrl(baseUrl: string): string {
  const base = normalize(baseUrl);
  return `${base}/api/json?tree=mode,nodeDescription,useSecurity`;
}
