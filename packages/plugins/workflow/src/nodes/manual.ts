import type { NodeHandler, WorkflowNode, JobResult } from './base';
import type { ExecutionContext } from '../engine/context';

/**
 * Manual node — pauses execution for human approval / rejection.
 *
 * The executor detects the 'pending' status and stops processing downstream
 * nodes.  When the API caller invokes `executor.resume(executionId, nodeId, result)`
 * with an approved/rejected payload, execution continues from the next node.
 *
 * config:
 *   assignees?:    string[]  — user IDs who should act
 *   title?:        string    — label shown to the assignee
 *   description?:  string
 */
export class ManualNode implements NodeHandler {
  readonly type = 'manual';

  async execute(node: WorkflowNode, _context: ExecutionContext): Promise<JobResult> {
    const { assignees = [], title = 'Manual approval required', description = '' } = node.config ?? {};

    // Return 'pending' — executor will persist and pause here.
    return {
      status: 'pending',
      result: { assignees, title, description },
    };
  }
}
