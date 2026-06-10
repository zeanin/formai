import type { WorkflowExecutor } from '../engine/executor';

/**
 * Action handlers for the `executions` resource.
 */
export function createExecutionActions(executor: WorkflowExecutor) {
  return {
    /** GET /api/executions — list with optional workflowId filter */
    async list(ctx: any) {
      const { workflowId, page = 1, pageSize = 20 } = ctx.action.params ?? {};
      const repo = ctx.db.getRepository('executions');

      const filter: Record<string, any> = {};
      if (workflowId) filter.workflowId = workflowId;

      const [data, count] = await Promise.all([
        repo.find({ filter, limit: pageSize, offset: (page - 1) * pageSize }),
        repo.count({ filter }),
      ]);

      ctx.body = { data, meta: { page, pageSize, count } };
    },

    /** GET /api/executions/:id — single execution with its jobs */
    async get(ctx: any) {
      const { id } = ctx.action.params;
      const executionRepo = ctx.db.getRepository('executions');
      const execution = await executionRepo.findOne({ filter: { id } });
      if (!execution) {
        ctx.status = 404;
        ctx.body = { error: 'Execution not found' };
        return;
      }

      const jobRepo = ctx.db.getRepository('jobs');
      const jobs = await jobRepo.find({ filter: { executionId: id } });

      ctx.body = { ...execution, jobs };
    },

    /** POST /api/executions/:id/cancel */
    async cancel(ctx: any) {
      const { id } = ctx.action.params;
      await executor.cancel(id);
      ctx.body = { success: true, id };
    },

    /**
     * POST /api/executions/:id/resume
     * Body: { nodeId: string, approved: boolean, comment?: string }
     */
    async resume(ctx: any) {
      const { id } = ctx.action.params;
      const body = ctx.action.params?.values ?? ctx.request?.body ?? {};
      const { nodeId, approved, comment } = body;

      if (!nodeId) {
        ctx.status = 400;
        ctx.body = { error: 'nodeId is required' };
        return;
      }

      await executor.resume(id, nodeId, { approved: Boolean(approved), comment });
      ctx.body = { success: true, id, nodeId };
    },
  };
}
