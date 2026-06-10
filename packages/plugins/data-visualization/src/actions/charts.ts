import { Context, Next } from 'koa';

export async function list(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('charts');
  const { filter, fields, sort, page = 1, pageSize = 50 } = (ctx as any).action.params;
  const { rows, count } = await repo.findAndCount({
    filter,
    fields,
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

export async function get(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('charts');
  const { filterByTk } = (ctx as any).action.params;
  const row = await repo.findById(filterByTk);
  if (!row) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Chart not found', code: 'NOT_FOUND' }] };
    return;
  }
  ctx.body = { data: row };
  await next();
}

export async function create(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('charts');
  const { values } = (ctx as any).action.params;
  if (!values?.title || !values?.type || !values?.collection) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'title, type, and collection are required', code: 'VALIDATION_ERROR' }] };
    return;
  }
  const userId = (ctx as any).state?.currentUser?.id;
  const record = await repo.create({
    values: {
      title: values.title,
      type: values.type,
      collection: values.collection,
      config: values.config || {},
      createdById: userId,
    },
  });
  ctx.status = 201;
  ctx.body = { data: record };
  await next();
}

export async function update(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('charts');
  const { filterByTk, values } = (ctx as any).action.params;
  const updated = await repo.update({ filter: { id: filterByTk }, values });
  ctx.body = { data: updated };
  await next();
}

export async function destroy(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('charts');
  const { filterByTk } = (ctx as any).action.params;
  const count = await repo.destroy({ filter: { id: filterByTk } });
  ctx.body = { data: count };
  await next();
}
