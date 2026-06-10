import { Context, Next } from 'koa';

/**
 * Get a single setting by key
 */
export async function get(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('systemSettings');
  const { filterByTk } = (ctx as any).action.params;

  if (!filterByTk) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'Setting key is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const row = await repo.findOne({ filter: { key: filterByTk } });
  if (!row) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Setting not found', code: 'NOT_FOUND' }] };
    return;
  }

  ctx.body = { data: row };
  await next();
}

/**
 * Set a setting value (upsert)
 */
export async function set(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('systemSettings');
  const { values } = (ctx as any).action.params;

  if (!values?.key) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'Setting key is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  // Upsert: find existing or create new
  const existing = await repo.findOne({ filter: { key: values.key } });

  if (existing) {
    const updated = await repo.update({
      filterByTk: existing.id,
      values: {
        value: values.value !== undefined ? values.value : existing.value,
        group: values.group || existing.group,
      },
    });
    ctx.body = { data: updated };
  } else {
    const record = await repo.create({
      values: {
        key: values.key,
        value: values.value ?? null,
        group: values.group || 'general',
      },
    });
    ctx.status = 201;
    ctx.body = { data: record };
  }

  await next();
}

/**
 * Get all settings, optionally filtered by group
 */
export async function getAll(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('systemSettings');
  const { filter, sort, page = 1, pageSize = 100 } = (ctx as any).action.params;

  const { rows, count } = await repo.findAndCount({
    filter,
    sort: sort || ['group', 'key'],
    page: Number(page),
    pageSize: Number(pageSize),
  });

  ctx.body = {
    data: rows,
    meta: { count, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(count / Number(pageSize)) },
  };
  await next();
}
