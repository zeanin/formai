import { Context, Next } from 'koa';

/**
 * GET /api/auditLogs
 * Search and filter audit logs by user, resource, action, date range.
 */
export async function list(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const repo = db.getRepository('auditLogs');

  const {
    filter,
    sort,
    page = 1,
    pageSize = 50,
    userId,
    resource,
    action,
    startDate,
    endDate,
  } = (ctx as any).action.params;

  // Build merged filter
  const mergedFilter: Record<string, unknown> = { ...(filter || {}) };
  if (userId) mergedFilter['userId'] = Number(userId);
  if (resource) mergedFilter['resource'] = resource;
  if (action) mergedFilter['action'] = action;
  if (startDate) mergedFilter['createdAt'] = { ...(mergedFilter['createdAt'] as object || {}), $gte: startDate };
  if (endDate) {
    mergedFilter['createdAt'] = {
      ...(mergedFilter['createdAt'] as object || {}),
      $lte: endDate,
    };
  }

  const { rows, count } = await repo.findAndCount({
    filter: mergedFilter,
    sort: sort || ['-createdAt'],
    page: Number(page),
    pageSize: Number(pageSize),
  });

  ctx.body = {
    data: rows,
    meta: {
      count,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(count / Number(pageSize)),
    },
  };
  await next();
}

/**
 * GET /api/auditLogs/:id
 */
export async function get(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk } = (ctx as any).action.params;
  const repo = db.getRepository('auditLogs');

  const row = await repo.findById(filterByTk);
  if (!row) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Audit log not found', code: 'NOT_FOUND' }] };
    return;
  }
  ctx.body = { data: row };
  await next();
}
