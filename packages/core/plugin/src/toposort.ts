export class CircularDependencyError extends Error {
  constructor(public cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
    this.name = 'CircularDependencyError';
  }
}

/**
 * Topological sort using Kahn's algorithm.
 * Throws CircularDependencyError if a cycle is detected.
 */
export function toposort(nodes: Array<{ name: string; dependencies?: string[] }>): string[] {
  const nameSet = new Set(nodes.map((n) => n.name));
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>(); // name -> names that depend on it

  for (const node of nodes) {
    if (!inDegree.has(node.name)) {
      inDegree.set(node.name, 0);
    }
    if (!adjList.has(node.name)) {
      adjList.set(node.name, []);
    }
    for (const dep of node.dependencies ?? []) {
      // Only consider deps that are in the node set
      if (!nameSet.has(dep)) {
        continue;
      }
      inDegree.set(node.name, (inDegree.get(node.name) ?? 0) + 1);
      const dependents = adjList.get(dep) ?? [];
      dependents.push(node.name);
      adjList.set(dep, dependents);
    }
  }

  // Start with all nodes that have no dependencies
  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const dependent of adjList.get(current) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  if (result.length !== nodes.length) {
    // There's a cycle - find it
    const cycle = findCycle(nodes, result);
    throw new CircularDependencyError(cycle);
  }

  return result;
}

/**
 * Find a cycle among the nodes that were not processed (remaining after Kahn's).
 */
function findCycle(
  nodes: Array<{ name: string; dependencies?: string[] }>,
  processed: string[],
): string[] {
  const processedSet = new Set(processed);
  const remaining = nodes.filter((n) => !processedSet.has(n.name));

  if (remaining.length === 0) {
    return [];
  }

  const nameSet = new Set(nodes.map((n) => n.name));

  // DFS to find cycle path
  const visited = new Set<string>();
  const path: string[] = [];
  const pathSet = new Set<string>();

  function dfs(name: string): string[] | null {
    if (pathSet.has(name)) {
      // Found cycle - extract it
      const idx = path.indexOf(name);
      return [...path.slice(idx), name];
    }
    if (visited.has(name)) {
      return null;
    }
    visited.add(name);
    path.push(name);
    pathSet.add(name);

    const node = nodes.find((n) => n.name === name);
    for (const dep of node?.dependencies ?? []) {
      if (!nameSet.has(dep)) continue;
      const cycle = dfs(dep);
      if (cycle) return cycle;
    }

    path.pop();
    pathSet.delete(name);
    return null;
  }

  for (const node of remaining) {
    const cycle = dfs(node.name);
    if (cycle) return cycle;
  }

  return remaining.map((n) => n.name);
}
