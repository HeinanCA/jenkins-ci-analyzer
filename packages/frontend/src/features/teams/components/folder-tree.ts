export interface FolderNode {
  readonly name: string;
  readonly path: string;
  readonly children: FolderNode[];
  readonly jobCount: number;
}

// Local mutation during tree construction is intentional --
// the tree is built fresh each invocation and never escapes until complete.
export function buildFolderTree(jobs: { fullPath: string }[]): FolderNode[] {
  const root: FolderNode[] = [];
  for (const job of jobs) {
    const parts = job.fullPath.split("/");
    if (parts.length < 2) continue;
    const folderParts = parts.slice(0, -1);
    let current = root;
    let currentPath = "";
    for (const part of folderParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = current.find((n) => n.name === part);
      if (!node) {
        node = { name: part, path: currentPath, children: [], jobCount: 0 };
        current.push(node);
      }
      (node as { jobCount: number }).jobCount++;
      current = node.children;
    }
  }
  return root;
}

export function filterTree(nodes: FolderNode[], search: string): FolderNode[] {
  if (!search) return nodes;
  const lower = search.toLowerCase();
  return nodes
    .map((node) => {
      const childMatches = filterTree(node.children, search);
      const nameMatches = node.name.toLowerCase().includes(lower);
      if (nameMatches || childMatches.length > 0) {
        return { ...node, children: childMatches };
      }
      return null;
    })
    .filter((n): n is FolderNode => n !== null);
}
