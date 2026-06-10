import { Context, Next } from 'koa';

/**
 * GET /api/backups
 */
export async function listAction(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filter, sort, page = 1, pageSize = 20 } = (ctx as any).action.params;
  const repo = db.getRepository('backups');
  const { rows, count } = await repo.findAndCount({
    filter,
    sort: sort || ['-createdAt'],
    page: Number(page),
    pageSize: Number(pageSize),
  });
  ctx.body = {
    data: rows,
    meta: { count, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(count / Number(pageSize)) },
  };
  await next();
}

/**
 * GET /api/backups/:id
 */
export async function getAction(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk } = (ctx as any).action.params;
  const repo = db.getRepository('backups');
  const record = await repo.findById(filterByTk);
  if (!record) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Backup not found', code: 'NOT_FOUND' }] };
    return;
  }
  ctx.body = { data: record };
  await next();
}

/**
 * DELETE /api/backups/:id
 */
export async function destroyAction(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk } = (ctx as any).action.params;
  const repo = db.getRepository('backups');

  const record = await repo.findById(filterByTk);
  if (!record) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Backup not found', code: 'NOT_FOUND' }] };
    return;
  }

  // Remove the physical file if it exists
  if (record.storagePath) {
    try {
      const { unlinkSync, existsSync } = await import('fs');
      if (existsSync(record.storagePath)) {
        unlinkSync(record.storagePath);
      }
    } catch { /* ignore */ }
  }

  await repo.destroy({ filter: { id: filterByTk } });
  ctx.body = { data: { deleted: true } };
  await next();
}
