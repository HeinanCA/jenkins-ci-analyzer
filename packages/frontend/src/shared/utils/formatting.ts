/**
 * Single source of truth for all display formatting.
 * No duplicate formatDuration/formatTimeAgo across pages.
 */

export function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return "< 1m";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function shortenJobName(fullPath: string): string {
  const parts = fullPath.split("/");
  if (parts.length <= 2) return fullPath;
  return `.../${parts.slice(-2).join("/")}`;
}
