import type { NodeHandler, WorkflowNode, JobResult } from './base';
import type { ExecutionContext } from '../engine/context';

/**
 * Parallel node — schedules multiple branches to run concurrently.
 *
 * config:
 *   branches: string[][]  — each element is an array of node IDs for one branch
 *
 * The executor drives actual parallel execution; this node simply returns the
 * branch node-ID lists as `nextNodes` so the executor knows what to fan out.
 */
export class ParallelNode implements NodeHandler {
  readonly type = 'parallel';

  async execute(node: WorkflowNode, _context: ExecutionContext): Promise<JobResult> {
    const { branches = [] } = node.config ?? {};

    // Collect the first node of every branch as parallel starts
    const firstNodes: string[] = (branches as string[][])
      .map((branch) => branch[0])
      .filter(Boolean);

    return {
      status: 'resolved',
      result: { branches },
      nextNodes: firstNodes,
    };
  }
}
