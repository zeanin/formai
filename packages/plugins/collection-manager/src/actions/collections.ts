import { Context, Next } from 'koa';
import { CollectionOptions } from '@formai/shared';

/**
 * List all collections metadata
 * Supports ?appId=crm to filter by app, or ?appId=_platform for platform-shared only
 */
export async function list(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('collections');
  const { filter, fields, sort, page = 1, pageSize = 50, appId } = (ctx as any).action.params;

  // Build filter with appId scoping
  const filterObj: any = { ...(filter || {}) };
  if (appId === '_platform') {
    // Only platform-shared collections (appId IS NULL)
    filterObj.appId = null;
  } else if (appId) {
    // App-specific collections + platform-shared
    filterObj.$or = [
      { appId },
      { appId: null },
    ];
  }

  const { rows, count } = await repo.findAndCount({
    filter: filterObj,
    fields,
    sort: sort || ['name'],
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
 * Get a single collection by name
 */
export async function get(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('collections');
  const { filterByTk } = (ctx as any).action.params;

  const row = await repo.findOne({ filter: { name: filterByTk } });
  if (!row) {
    // Try by id
    const byId = await repo.findById(filterByTk);
    if (!byId) {
      ctx.status = 404;
      ctx.body = { errors: [{ message: 'Collection not found', code: 'NOT_FOUND' }] };
      return;
    }
    ctx.body = { data: byId };
    await next();
    return;
  }
  ctx.body = { data: row };
  await next();
}

/**
 * Create a new collection definition and sync it to the DB.
 *
 * Uses a transaction to ensure atomicity: if DDL fails (e.g. table already exists
 * at DB level), the metadata insert is rolled back and the caller receives a clean error.
 */
export async function create(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const repo = db.getRepository('collections');
  const { values } = (ctx as any).action.params;

  if (!values?.name) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'Collection name is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  // Ensure title defaults to the original name before applying prefix
  if (!values.title) {
    values.title = values.name;
  }

  // Prefix collection name for app-scoped collections
  const appId = values.appId || null;
  if (appId && appId !== '_platform') {
    const namePrefix = `app_${appId}_`;
    if (!values.name.startsWith(namePrefix)) {
      values.name = `${namePrefix}${values.name}`;
    }
  }

  // Prevent clashing with or overwriting any pre-existing collections (system tables or other business tables)
  if (db.hasCollection(values.name)) {
    ctx.status = 400;
    ctx.body = {
      errors: [
        {
          message: `Collection name "${values.name}" is already in use or reserved by the system`,
          code: 'COLLECTION_EXISTS',
        },
      ],
    };
    return;
  }

  let record: any;

  try {
    // Wrap metadata insert + DDL in a single transaction so they succeed or fail together.
    await repo.transaction(async (transaction: any) => {
      // Generate physical table name with a default prefix 't_' if not explicitly supplied
      let autoTableName = values.tableName || values.options?.tableName;
      if (!autoTableName) {
        if (appId && appId !== '_platform') {
          autoTableName = values.name; // Already prefixed with app_${appId}_
        } else {
          autoTableName = `t_${values.name}`;
        }
      } else if (appId && appId !== '_platform') {
        const tablePrefix = `app_${appId}_`;
        if (!autoTableName.startsWith(tablePrefix)) {
          let baseTableName = autoTableName;
          if (baseTableName.startsWith(`t_app_${appId}_`)) {
            baseTableName = baseTableName.slice(`t_app_${appId}_`.length);
          } else if (baseTableName.startsWith('t_')) {
            baseTableName = baseTableName.slice(2);
          }
          autoTableName = `${tablePrefix}${baseTableName}`;
        }
      }
      const recordOptions = {
        ...(values.options || {}),
        tableName: autoTableName,
      };

      // 1. Write metadata
      record = await repo.create({
        values: {
          name: values.name,
          title: values.title,
          appId: values.appId || null,  // null = platform-shared
          options: recordOptions,
        },
        transaction,
      });

      const filteredFields = (values.fields || []).filter(
        (f: any) => !['id', 'createdAt', 'updatedAt', 'deletedAt', 'created_at', 'updated_at', 'deleted_at', 'isDeleted', 'is_deleted', 'deleted'].includes(f.name)
      );

      // 2. Register collection definition in memory
      const collectionOptions: CollectionOptions = {
        name: values.name,
        title: values.title,
        fields: filteredFields,
        tableName: autoTableName,
        ...recordOptions,
      };
      db.collection(collectionOptions);

      // Persist initial fields metadata (if supplied, e.g. from UI auto-generator)
      const fieldsRepo = db.getRepository('fields');
      if (fieldsRepo && filteredFields.length > 0) {
        for (const f of filteredFields) {
          await fieldsRepo.create({
            values: {
              collectionName: values.name,
              name: f.name,
              type: f.type,
              options: {
                title: f.title || f.name,
                ...(f.options || {}),
              },
              sort: f.sort || 0,
            },
            transaction,
          });
        }
      }

      // 3. Sync the actual table to the database (CREATE TABLE / ALTER TABLE)
      //    alter:false — this is a brand-new collection, no existing columns to alter.
      await db.syncCollection(values.name, { alter: false, transaction });
    });
  } catch (err: any) {
    ctx.status = 500;
    ctx.body = { errors: [{ message: `Failed to create collection: ${err.message}`, code: 'SYNC_ERROR' }] };
    return;
  }

  ctx.status = 201;
  ctx.body = { data: record };
  await next();
}

/**
 * Update a collection definition (title / options).
 * When fields are supplied the collection is re-synced so new columns are added.
 */
export async function update(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const repo = db.getRepository('collections');
  const { filterByTk, values } = (ctx as any).action.params;

  const updated = await repo.update({
    filter: { name: filterByTk },
    values: {
      ...(values?.title ? { title: values.title } : {}),
      ...(values?.options ? { options: values.options } : {}),
    },
  });

  // Re-sync if fields or options changed — only ADD new columns (alter:true, drop:false at Sequelize level)
  if (values?.fields || values?.options) {
    try {
      const existing = await repo.findOne({ filter: { name: filterByTk } });
      if (existing) {
        const filteredFields = (values.fields || []).filter(
          (f: any) => !['id', 'createdAt', 'updatedAt', 'deletedAt', 'created_at', 'updated_at', 'deleted_at', 'isDeleted', 'is_deleted', 'deleted'].includes(f.name)
        );
        const collectionOptions: CollectionOptions = {
          name: filterByTk,
          title: values.title || existing.title,
          fields: filteredFields,
          ...(values.options || existing.options || {}),
        };
        db.collection(collectionOptions);
        await db.syncCollection(filterByTk, { alter: true });
      }
    } catch (err: any) {
      ctx.status = 500;
      ctx.body = { errors: [{ message: `Failed to sync collection: ${err.message}`, code: 'SYNC_ERROR' }] };
      return;
    }
  }

  ctx.body = { data: updated };
  await next();
}

/**
 * Delete a collection definition and drop the underlying table.
 *
 * Uses db.dropTable() (Sequelize queryInterface) instead of raw SQL so that
 * schema-qualified table names are handled correctly across dialects.
 */
export async function destroy(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const repo = db.getRepository('collections');
  const { filterByTk } = (ctx as any).action.params;

  // Confirm the collection exists before touching anything
  const existing = await repo.findOne({ filter: { name: filterByTk } });

  // Delete all field metadata for this collection first (FK cascade may handle it,
  // but explicit cleanup is safer when cascade is not guaranteed)
  const fieldsRepo = db.getRepository('fields');
  if (fieldsRepo) {
    await fieldsRepo.destroy({ filter: { collectionName: filterByTk } });
  }

  // Delete collection metadata record
  const count = await repo.destroy({ filter: { name: filterByTk } });

  // Remove collection from in-memory registry and drop the physical table
  if (existing) {
    try {
      // Drop the table via queryInterface (handles schema, cascade, IF EXISTS)
      await db.dropTable(filterByTk, { cascade: true });
    } catch {
      // Ignore drop errors (table may never have been created, e.g. after a failed create)
    }
    // Remove from in-memory collection map *after* DDL so dropTable can still resolve tableName
    db.removeCollection(filterByTk);
  }

  ctx.body = { data: count };
  await next();
}
