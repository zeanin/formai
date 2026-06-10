import { Context, Next } from 'koa';

export async function list(ctx: Context, next: Next): Promise<void> {
  const { resourceName } = (ctx as any).action;
  const repo = (ctx as any).app.db.getRepository(resourceName);
  const {
    filter,
    fields,
    appends,
    except,
    sort,
    page = 1,
    pageSize = 20,
  } = (ctx as any).action.params;

  const { rows, count } = await repo.findAndCount({
    filter,
    fields,
    except,
    appends,
    sort,
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

export async function get(ctx: Context, next: Next): Promise<void> {
  const { resourceName } = (ctx as any).action;
  const repo = (ctx as any).app.db.getRepository(resourceName);
  const { filterByTk, fields, appends, except } = (ctx as any).action.params;

  const row = await repo.findById(filterByTk);
  if (!row) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Not Found', code: 'NOT_FOUND' }] };
    return;
  }

  ctx.body = { data: row };
  await next();
}

export async function create(ctx: Context, next: Next): Promise<void> {
  const { resourceName } = (ctx as any).action;
  const repo = (ctx as any).app.db.getRepository(resourceName);
  const { values, whitelist, blacklist } = (ctx as any).action.params;

  const record = await repo.create({ values, whitelist, blacklist });
  ctx.status = 200;
  ctx.body = { data: record };
  await next();
}

export async function update(ctx: Context, next: Next): Promise<void> {
  const { resourceName } = (ctx as any).action;
  const repo = (ctx as any).app.db.getRepository(resourceName);
  const { filterByTk, values, filter, whitelist, blacklist } = (ctx as any).action.params;

  const updated = await repo.update({ filterByTk, values, filter, whitelist, blacklist });
  ctx.body = { data: updated };
  await next();
}

export async function destroy(ctx: Context, next: Next): Promise<void> {
  const { resourceName } = (ctx as any).action;
  const repo = (ctx as any).app.db.getRepository(resourceName);
  let { filterByTk, filter } = (ctx as any).action.params;

  // Safeguard: Check if ids were passed in request body
  const body = (ctx.request as any)?.body;
  if (!filterByTk && (!filter || Object.keys(filter).length === 0)) {
    if (body && Array.isArray(body.ids)) {
      filter = { id: { $in: body.ids } };
    } else if (ctx.query && ctx.query.ids) {
      const ids = Array.isArray(ctx.query.ids)
        ? ctx.query.ids
        : String(ctx.query.ids).split(',').map((id: string) => id.trim()).filter(Boolean);
      filter = { id: { $in: ids } };
    }
  }

  // Catastrophe Protection: Block empty delete requests that would wipe the entire table
  if (!filterByTk && (!filter || Object.keys(filter).length === 0)) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'Bulk delete action requires specific IDs or filter parameters to be specified.', code: 'MISSING_FILTER' }] };
    return;
  }

  const count = await repo.destroy({ filterByTk, filter });
  ctx.body = { data: count };
  await next();
}
