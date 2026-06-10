import { Context, Next } from 'koa';
import { LoggerService } from '../services/logger-service';
import { AUDITED_ACTIONS } from '../types';

/**
 * Koa middleware that auto-logs all mutating resource actions.
 * Captures before/after values for update operations.
 */
export function auditMiddleware(db: any) {
  const logger = new LoggerService(db);

  return async (ctx: Context, next: Next): Promise<void> => {
    const action = (ctx as any).action;

    // Only log if this is a resource action we care about
    if (!action || !AUDITED_ACTIONS.has(action.actionName)) {
      await next();
      return;
    }

    const resourceName: string = action.resourceName || '';
    const actionName: string = action.actionName || '';
    const params = action.params || {};
    const user = (ctx as any).state?.currentUser;
    const ip = ctx.ip || ctx.request.ip || '';
    const userAgent = ctx.get('user-agent') || '';

    // For updates: capture the "before" state
    let before: Record<string, unknown> | undefined;
    if (actionName === 'update' && params.filterByTk) {
      try {
        const repo = db.getRepository(resourceName);
        if (repo) {
          const row = await repo.findById(params.filterByTk);
          if (row) {
            before = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
          }
        }
      } catch { /* ignore */ }
    }

    // Execute the actual action
    await next();

    // Capture "after" state for updates
    let after: Record<string, unknown> | undefined;
    if (actionName === 'update' && params.filterByTk) {
      try {
        const repo = db.getRepository(resourceName);
        if (repo) {
          const row = await repo.findById(params.filterByTk);
          if (row) {
            after = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
          }
        }
      } catch { /* ignore */ }
    }

    // Determine recordId
    let recordId: string | undefined;
    if (params.filterByTk) {
      recordId = String(params.filterByTk);
    } else if (ctx.body && (ctx.body as any).data?.id) {
      recordId = String((ctx.body as any).data.id);
    }

    // Build changes object
    const changes = (before || after)
      ? { before, after: after ?? params.values }
      : (params.values ? { after: params.values } : undefined);

    await logger.log({
      userId: user?.id,
      username: user?.username || user?.email,
      resource: resourceName,
      action: actionName,
      collectionName: resourceName,
      recordId,
      changes,
      ip,
      userAgent,
    });
  };
}
