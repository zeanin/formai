import type { NodeHandler, WorkflowNode, JobResult } from './base';
import type { ExecutionContext } from '../engine/context';

/**
 * Query node — fetches records from a collection.
 *
 * config:
 *   collection: string
 *   filter?:    object
 *   fields?:    string[]
 *   limit?:     number  (default: 100)
 */
export class QueryNode implements NodeHandler {
  readonly type = 'query';

  constructor(private db: any) {}

  async execute(node: WorkflowNode, _context: ExecutionContext): Promise<JobResult> {
    const { collection, filter, fields, limit = 100 } = node.config ?? {};

    if (!collection) {
      return { status: 'rejected', result: { error: 'collection is required' } };
    }

    const repo = this.db.getRepository(collection);
    const data = await repo.find({
      filter: filter ?? {},
      fields: fields,
      limit,
    });

    return { status: 'resolved', result: { data } };
  }
}
