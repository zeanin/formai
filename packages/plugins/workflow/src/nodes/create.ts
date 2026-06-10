import type { NodeHandler, WorkflowNode, JobResult } from './base';
import type { ExecutionContext } from '../engine/context';

/**
 * Create node — creates a new record in a collection.
 *
 * config:
 *   collection: string
 *   values:     Record<string, any>
 */
export class CreateNode implements NodeHandler {
  readonly type = 'create';

  constructor(private db: any) {}

  async execute(node: WorkflowNode, _context: ExecutionContext): Promise<JobResult> {
    const { collection, values } = node.config ?? {};

    if (!collection) {
      return { status: 'rejected', result: { error: 'collection is required' } };
    }

    const repo = this.db.getRepository(collection);
    const record = await repo.create({ values: values ?? {} });

    return { status: 'resolved', result: { record } };
  }
}
