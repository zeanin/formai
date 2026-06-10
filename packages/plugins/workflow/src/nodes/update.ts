import type { NodeHandler, WorkflowNode, JobResult } from './base';
import type { ExecutionContext } from '../engine/context';

/**
 * Update node — updates records in a collection.
 *
 * config:
 *   collection: string
 *   filter:     object  — which records to update
 *   values:     Record<string, any>
 */
export class UpdateNode implements NodeHandler {
  readonly type = 'update';

  constructor(private db: any) {}

  async execute(node: WorkflowNode, _context: ExecutionContext): Promise<JobResult> {
    const { collection, filter, values } = node.config ?? {};

    if (!collection) {
      return { status: 'rejected', result: { error: 'collection is required' } };
    }

    const repo = this.db.getRepository(collection);
    const records = await repo.update({ filter: filter ?? {}, values: values ?? {} });

    return { status: 'resolved', result: { updated: records } };
  }
}
