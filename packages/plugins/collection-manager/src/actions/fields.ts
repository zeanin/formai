import { Context, Next } from 'koa';

/**
 * List fields for a collection
 */
export async function list(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('fields');
  const { filter, fields, sort, page = 1, pageSize = 100 } = (ctx as any).action.params;

  const { rows, count } = await repo.findAndCount({
    filter,
    fields,
    sort: sort || ['collectionName', 'sort'],
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
 * Get a single field by id
 */
export async function get(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('fields');
  const { filterByTk } = (ctx as any).action.params;

  const row = await repo.findById(filterByTk);
  if (!row) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Field not found', code: 'NOT_FOUND' }] };
    return;
  }

  ctx.body = { data: row };
  await next();
}

/**
 * Add a field to a collection and sync.
 * Only adds the column (alter:true with Sequelize never drops, only adds).
 */
export async function create(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const repo = db.getRepository('fields');
  const { values } = (ctx as any).action.params;

  if (!values?.collectionName || !values?.name || !values?.type) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'collectionName, name, and type are required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const systemFieldNames = [
    'id', 'createdAt', 'updatedAt', 'deletedAt',
    'created_at', 'updated_at', 'deleted_at',
    'isDeleted', 'is_deleted', 'deleted'
  ];
  if (systemFieldNames.includes(values.name)) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: `Field name "${values.name}" is a reserved system field name and cannot be created.`, code: 'VALIDATION_ERROR' }] };
    return;
  }

  // Store field metadata
  const record = await repo.create({
    values: {
      collectionName: values.collectionName,
      name: values.name,
      type: values.type,
      options: values.options || {},
      sort: values.sort || 0,
    },
  });

  // Sync: add column to the physical table
  try {
    const collection = db.getCollection(values.collectionName);
    if (collection) {
      collection.addField({
        name: values.name,
        type: values.type,
        ...(values.options || {}),
      });
      // alter:true adds the new column; Sequelize never drops existing columns in alter mode
      await db.syncCollection(values.collectionName, { alter: true });
    }
  } catch (err: any) {
    ctx.status = 500;
    ctx.body = { errors: [{ message: `Failed to sync field: ${err.message}`, code: 'SYNC_ERROR' }] };
    return;
  }

  ctx.status = 201;
  ctx.body = { data: record };
  await next();
}

/**
 * Update a field definition and re-sync.
 */
export async function update(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const repo = db.getRepository('fields');
  const { filterByTk, values } = (ctx as any).action.params;

  const existing = await repo.findById(filterByTk);
  if (!existing) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Field not found', code: 'NOT_FOUND' }] };
    return;
  }

  const updated = await repo.update({
    filterByTk,
    values: {
      ...(values?.type ? { type: values.type } : {}),
      ...(values?.options ? { options: values.options } : {}),
      ...(values?.sort !== undefined ? { sort: values.sort } : {}),
    },
  });

  // Re-sync the collection so any column type/default changes are applied
  try {
    const collection = db.getCollection(existing.collectionName);
    if (collection) {
      collection.addField({
        name: existing.name,
        type: values?.type || existing.type,
        ...(values?.options || existing.options || {}),
      });
      await db.syncCollection(existing.collectionName, { alter: true });
    }
  } catch {
    // Ignore sync errors during update (non-fatal — metadata is already saved)
  }

  ctx.body = { data: updated };
  await next();
}

/**
 * Remove a field from a collection.
 *
 * Critical fix: Sequelize's model.sync({ alter: true }) does NOT drop columns.
 * We must explicitly call db.removeColumn() → queryInterface.removeColumn() to
 * physically remove the column from the database.
 */
export async function destroy(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const repo = db.getRepository('fields');
  const { filterByTk } = (ctx as any).action.params;

  const existing = await repo.findById(filterByTk);
  if (!existing) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Field not found', code: 'NOT_FOUND' }] };
    return;
  }

  // 1. Delete the field metadata record
  const count = await repo.destroy({ filterByTk });

  // 2. Remove from in-memory collection definition
  const collection = db.getCollection(existing.collectionName);
  if (collection && collection.hasField(existing.name)) {
    collection.removeField(existing.name);
  }

  // 3. Physically drop the column from the database table.
  //    This is the critical step that Sequelize's alter-sync never does.
  try {
    await db.removeColumn(existing.collectionName, existing.name);
  } catch (err: any) {
    // Log but don't fail the request — metadata is already cleaned up.
    // The column may not exist (e.g. it's a virtual/relation field with no DB column).
    console.warn(
      `[fields.destroy] Could not drop column "${existing.name}" from "${existing.collectionName}": ${err.message}`,
    );
  }

  ctx.body = { data: count };
  await next();
}
