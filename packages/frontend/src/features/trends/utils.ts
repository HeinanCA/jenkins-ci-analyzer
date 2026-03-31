/**
 * Utility functions specific to the trends feature.
 * General-purpose formatting lives in shared/utils/formatting.ts.
 */

/** Split an array into two halves for period-over-period comparison. */
export function splitHalves<T>(data: readonly T[]): { prev: T[]; curr: T[] } {
  const mid = Math.ceil(data.length / 2);
  return { prev: data.slice(0, mid), curr: data.slice(mid) };
}

export function avg(nums: readonly number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function sum(nums: readonly number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
