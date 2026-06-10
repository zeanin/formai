import { Context, Next } from 'koa';

/**
 * Get translations for a specific locale and namespace.
 * Returns a flat key-value map suitable for i18n libraries.
 */
export async function getByLocale(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('translations');
  const { locale, namespace } = (ctx as any).action.params;

  if (!locale) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'locale parameter is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const filter: any = { locale };
  if (namespace) {
    filter.namespace = namespace;
  }

  const rows = await repo.find({ filter });

  // Convert to key-value map
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value || '';
  }

  ctx.body = { data: { locale, namespace: namespace || '*', translations: result } };
  await next();
}

/**
 * Bulk import translations.
 * Expects an array of { locale, namespace, key, value } objects.
 * Uses upsert logic: update if key exists, create if not.
 */
export async function bulkImport(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('translations');
  const { values } = (ctx as any).action.params;

  if (!values?.translations || !Array.isArray(values.translations)) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'translations array is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const results: any[] = [];
  let created = 0;
  let updated = 0;

  for (const entry of values.translations) {
    if (!entry.locale || !entry.key) continue;

    const namespace = entry.namespace || 'common';
    const existing = await repo.findOne({
      filter: { locale: entry.locale, namespace, key: entry.key },
    });

    if (existing) {
      await repo.update({
        filterByTk: existing.id,
        values: { value: entry.value ?? '' },
      });
      updated++;
    } else {
      const record = await repo.create({
        values: {
          locale: entry.locale,
          namespace,
          key: entry.key,
          value: entry.value ?? '',
        },
      });
      results.push(record);
      created++;
    }
  }

  ctx.body = { data: { created, updated, total: values.translations.length } };
  await next();
}

/**
 * Export all translations, optionally filtered by locale and/or namespace.
 * Returns an array of translation objects.
 */
export async function exportTranslations(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('translations');
  const { locale, namespace } = (ctx as any).action.params;

  const filter: any = {};
  if (locale) filter.locale = locale;
  if (namespace) filter.namespace = namespace;

  const rows = await repo.find({ filter, sort: ['locale', 'namespace', 'key'] });

  ctx.body = { data: rows };
  await next();
}

/**
 * List all translations with pagination
 */
export async function list(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('translations');
  const { filter, fields, sort, page = 1, pageSize = 100 } = (ctx as any).action.params;

  const { rows, count } = await repo.findAndCount({
    filter,
    fields,
    sort: sort || ['locale', 'namespace', 'key'],
    page: Number(page),
    pageSize: Number(pageSize),
  });

  ctx.body = {
    data: rows,
    meta: { count, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(count / Number(pageSize)) },
  };
  await next();
}
