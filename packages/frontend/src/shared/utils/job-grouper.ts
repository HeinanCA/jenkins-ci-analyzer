import type { FlatJob } from '../hooks/use-fetch-folders';

export interface JobGroup {
  readonly label: string;
  readonly jobs: readonly FlatJob[];
  readonly subGroups?: readonly JobSubGroup[];
}

export interface JobSubGroup {
  readonly label: string;
  readonly jobs: readonly FlatJob[];
}

function getCategory(fullPath: string): string {
  if (fullPath.startsWith('Automation/')) return 'Automation';
  if (fullPath.startsWith('AWS/')) return 'AWS';
  if (fullPath.startsWith('Releases/')) return 'Releases';
  if (fullPath.startsWith('github/web/')) return 'Frontend';
  if (fullPath.startsWith('github/Service/')) return 'Backend';
  if (fullPath.startsWith('github/Libraries/')) return 'Libraries';
  const top = fullPath.split('/')[0];
  return top;
}

function getRepoName(fullPath: string): string {
  const parts = fullPath.split('/');
  if (parts[0] === 'github' && parts.length >= 3) {
    return parts[2];
  }
  return parts[0];
}

function getBranchName(fullPath: string): string {
  const parts = fullPath.split('/');
  if (parts[0] === 'github' && parts.length >= 4) {
    return decodeURIComponent(parts.slice(3).join('/'));
  }
  if (parts.length >= 2) {
    return decodeURIComponent(parts.slice(1).join('/'));
  }
  return decodeURIComponent(fullPath);
}

function isPr(job: FlatJob): boolean {
  return getBranchName(job.fullPath).startsWith('PR-');
}

function isActive(job: FlatJob): boolean {
  return job.color !== 'notbuilt' && job.color !== 'disabled';
}

function isMainBranch(job: FlatJob): boolean {
  const branch = getBranchName(job.fullPath);
  return ['master', 'main', 'develop', 'prod', 'fda', 'mdr'].includes(branch)
    || branch.startsWith('releases/');
}

function buildRepoSubGroups(
  jobs: readonly FlatJob[],
  splitPrs: boolean,
): JobSubGroup[] {
  const repoMap = new Map<string, FlatJob[]>();
  for (const job of jobs) {
    const repo = getRepoName(job.fullPath);
    const existing = repoMap.get(repo) ?? [];
    repoMap.set(repo, [...existing, job]);
  }

  if (!splitPrs) {
    return [...repoMap.entries()].map(([repo, repoJobs]) => ({
      label: repo,
      jobs: repoJobs,
    }));
  }

  const subGroups: JobSubGroup[] = [];
  for (const [repo, repoJobs] of repoMap) {
    const mainBranches = repoJobs.filter(isMainBranch);
    const prJobs = repoJobs.filter(isPr).filter(isActive);
    const featureBranches = repoJobs.filter(
      (j) => !isMainBranch(j) && !isPr(j) && isActive(j),
    );

    if (mainBranches.length > 0) {
      subGroups.push({ label: `${repo}`, jobs: mainBranches });
    }
    if (prJobs.length > 0) {
      subGroups.push({ label: `${repo} — PRs`, jobs: prJobs });
    }
    if (featureBranches.length > 0) {
      subGroups.push({ label: `${repo} — Branches`, jobs: featureBranches });
    }
  }
  return subGroups;
}

export function groupJobs(jobs: readonly FlatJob[]): readonly JobGroup[] {
  const categoryMap = new Map<string, FlatJob[]>();
  for (const job of jobs) {
    const cat = getCategory(job.fullPath);
    const existing = categoryMap.get(cat) ?? [];
    categoryMap.set(cat, [...existing, job]);
  }

  const groups: JobGroup[] = [];
  const order = [
    'Automation',
    'Backend',
    'Libraries',
    'Frontend',
    'AWS',
    'Releases',
  ];

  for (const category of order) {
    const catJobs = categoryMap.get(category);
    if (!catJobs || catJobs.length === 0) continue;
    categoryMap.delete(category);

    const needsSplit =
      category === 'Backend' ||
      category === 'Libraries' ||
      category === 'Frontend';

    if (needsSplit) {
      groups.push({
        label: category,
        jobs: catJobs.filter(isActive),
        subGroups: buildRepoSubGroups(catJobs, true),
      });
    } else {
      groups.push({ label: category, jobs: catJobs });
    }
  }

  for (const [category, catJobs] of categoryMap) {
    groups.push({ label: category, jobs: catJobs });
  }

  return groups;
}
