import type { FailureEntry, GroupedFailure } from '../types';

export function groupByJob(failures: readonly FailureEntry[]): readonly GroupedFailure[] {
  const map = new Map<string, FailureEntry[]>();
  for (const f of failures) {
    const existing = map.get(f.jobFullPath) ?? [];
    map.set(f.jobFullPath, [...existing, f]);
  }

  return [...map.entries()]
    .map(([path, builds]) => {
      const sorted = builds.toSorted(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
      return {
        jobFullPath: path,
        jobName: sorted[0].jobName,
        latest: sorted[0],
        streak: sorted.length,
        builds: sorted,
      } satisfies GroupedFailure;
    })
    .toSorted((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      return new Date(b.latest.startedAt).getTime() - new Date(a.latest.startedAt).getTime();
    });
}
