import type { WorkflowExecutor } from '../engine/executor';
import type { TriggerManager } from '../services/trigger-manager';

/**
 * Action handlers for the `workflows` resource.
 *
 * Standard CRUD is handled automatically by the resourcer via the collection.
 * This file provides custom actions: enable, disable, and trigger.
 */

export function createWorkflowActions(executor: WorkflowExecutor, triggerManager: TriggerManager) {
  return {
    async list(ctx: any) {
      const repo = ctx.app.db.getRepository('workflows');
      const { filter, sort, page = 1, pageSize = 50, appId } = ctx.action?.params || {};

      // Build filter with appId scoping
      const filterObj: any = { ...(filter || {}) };
      if (appId === '_platform') {
        filterObj.appId = null;
      } else if (appId) {
        let numericAppId: number | null = null;
        if (!isNaN(Number(appId))) {
          numericAppId = Number(appId);
        } else {
          const appsRepo = ctx.app.db.getRepository('apps');
          if (appsRepo) {
            const app = await appsRepo.findOne({ filter: { name: appId } });
            if (app) {
              numericAppId = app.id;
            }
          }
        }
        filterObj.$or = [
          { appId: numericAppId },
          { appId: null },
        ];
      }

      const { rows, count } = await repo.findAndCount({
        filter: filterObj,
        sort: sort || ['-createdAt'],
        page: Number(page),
        pageSize: Number(pageSize),
      });

      ctx.body = {
        data: rows,
        meta: { count, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(count / Number(pageSize)) },
      };
    },

    async get(ctx: any) {
      const repo = ctx.app.db.getRepository('workflows');
      const { filterByTk } = ctx.action?.params || {};
      const workflow = await repo.findOne({ filter: { id: filterByTk } });
      if (!workflow) {
        ctx.status = 404;
        ctx.body = { errors: [{ message: 'Workflow not found', code: 'NOT_FOUND' }] };
        return;
      }
      ctx.body = { data: workflow };
    },

    async create(ctx: any) {
      const repo = ctx.app.db.getRepository('workflows');
      const { values } = ctx.action?.params || {};
      if (!values?.title) {
        ctx.status = 400;
        ctx.body = { errors: [{ message: 'title is required', code: 'VALIDATION_ERROR' }] };
        return;
      }
      let numericAppId: number | null = null;
      if (values.appId) {
        if (!isNaN(Number(values.appId))) {
          numericAppId = Number(values.appId);
        } else {
          const appsRepo = ctx.app.db.getRepository('apps');
          if (appsRepo) {
            const app = await appsRepo.findOne({ filter: { name: values.appId } });
            if (app) {
              numericAppId = app.id;
            }
          }
        }
      }

      const record = await repo.create({
        values: {
          title: values.title,
          description: values.description || null,
          appId: numericAppId,
          enabled: values.enabled ?? false,
          triggerType: values.triggerType || 'manual',
          triggerConfig: values.triggerConfig || {},
          nodes: values.nodes || [],
        },
      });
      ctx.status = 201;
      ctx.body = { data: record };
    },

    async update(ctx: any) {
      const repo = ctx.app.db.getRepository('workflows');
      const { filterByTk, values } = ctx.action?.params || {};
      const workflow = await repo.findOne({ filter: { id: filterByTk } });
      if (!workflow) {
        ctx.status = 404;
        ctx.body = { errors: [{ message: 'Workflow not found', code: 'NOT_FOUND' }] };
        return;
      }
      const updated = await repo.update({
        filter: { id: filterByTk },
        values: {
          ...(values?.title !== undefined ? { title: values.title } : {}),
          ...(values?.description !== undefined ? { description: values.description } : {}),
          ...(values?.enabled !== undefined ? { enabled: values.enabled } : {}),
          ...(values?.triggerType !== undefined ? { triggerType: values.triggerType } : {}),
          ...(values?.triggerConfig !== undefined ? { triggerConfig: values.triggerConfig } : {}),
          ...(values?.nodes !== undefined ? { nodes: values.nodes } : {}),
        },
      });

      // Re-register/unregister trigger based on enabled state
      if (values?.enabled !== undefined) {
        if (values.enabled) {
          try {
            const wf = await repo.findOne({ filter: { id: filterByTk } });
            if (wf) {
              triggerManager.register(filterByTk, wf.triggerType, wf.triggerConfig ?? {}, async (triggerCtx: any) => {
                await executor.execute(wf, triggerCtx);
              });
            }
          } catch (err: any) {
            console.warn(`[workflow] trigger registration warning: ${err.message}`);
          }
        } else {
          triggerManager.unregister(filterByTk, workflow.triggerType);
        }
      }

      ctx.body = { data: updated };
    },

    async destroy(ctx: any) {
      const repo = ctx.app.db.getRepository('workflows');
      const { filterByTk } = ctx.action?.params || {};
      const workflow = await repo.findOne({ filter: { id: filterByTk } });
      if (!workflow) {
        ctx.status = 404;
        ctx.body = { errors: [{ message: 'Workflow not found', code: 'NOT_FOUND' }] };
        return;
      }
      // Unregister trigger if enabled
      if (workflow.enabled) {
        triggerManager.unregister(filterByTk, workflow.triggerType);
      }
      await repo.destroy({ filter: { id: filterByTk } });
      ctx.body = { data: { success: true } };
    },
    /** POST /api/workflows/:id/enable */
    async enable(ctx: any) {
      const { id } = ctx.action.params;
      const repo = ctx.db.getRepository('workflows');
      const workflow = await repo.findOne({ filter: { id } });
      if (!workflow) {
        ctx.status = 404;
        ctx.body = { error: 'Workflow not found' };
        return;
      }

      await repo.update({ filter: { id }, values: { enabled: true } });

      // Register trigger
      try {
        triggerManager.register(id, workflow.triggerType, workflow.triggerConfig ?? {}, async (triggerCtx) => {
          const updated = await repo.findOne({ filter: { id } });
          if (updated?.enabled) {
            await executor.execute(updated, triggerCtx);
          }
        });
      } catch (err: any) {
        // Non-fatal: workflow is enabled but trigger registration may fail if type unknown
        console.warn(`[workflow] trigger registration warning: ${err.message}`);
      }

      ctx.body = { success: true, id };
    },

    /** POST /api/workflows/:id/disable */
    async disable(ctx: any) {
      const { id } = ctx.action.params;
      const repo = ctx.db.getRepository('workflows');
      const workflow = await repo.findOne({ filter: { id } });
      if (!workflow) {
        ctx.status = 404;
        ctx.body = { error: 'Workflow not found' };
        return;
      }

      await repo.update({ filter: { id }, values: { enabled: false } });
      triggerManager.unregister(id, workflow.triggerType);

      ctx.body = { success: true, id };
    },

    /** POST /api/workflows/:id/trigger — fires a manual trigger */
    async trigger(ctx: any) {
      const { id } = ctx.action.params;
      const input = ctx.action.params?.values ?? ctx.request?.body ?? {};

      const repo = ctx.db.getRepository('workflows');
      const workflow = await repo.findOne({ filter: { id } });
      if (!workflow) {
        ctx.status = 404;
        ctx.body = { error: 'Workflow not found' };
        return;
      }

      if (!workflow.enabled) {
        ctx.status = 400;
        ctx.body = { error: 'Workflow is not enabled' };
        return;
      }

      if (workflow.triggerType !== 'manual') {
        ctx.status = 400;
        ctx.body = { error: 'Workflow trigger type is not manual' };
        return;
      }

      const execution = await executor.execute(workflow, {
        triggeredAt: new Date().toISOString(),
        input,
      });

      ctx.body = { success: true, execution };
    },
  };
}
