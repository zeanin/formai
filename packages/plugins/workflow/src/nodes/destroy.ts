import type { NodeHandler, WorkflowNode, JobResult } from './base';
import type { ExecutionContext } from '../engine/context';

/**
 * Destroy node — deletes records from a collection.
 *
 * config:
 *   collection: string
 *   filter:     object
 */
export class DestroyNode implements NodeHandler {
  readonly type = 'destroy';

  constructor(private db: any) {}

  async execute(node: WorkflowNode, _context: ExecutionContext): Promise<JobResult> {
    const { collection, filter } = node.config ?? {};

    if (!collection) {
      return { status: 'rejected', result: { error: 'collection is required' } };
    }

    const repo = this.db.getRepository(collection);
    const count = await repo.destroy({ filter: filter ?? {} });

    return { status: 'resolved', result: { deleted: count } };
  }
}
