import { Context, Next } from 'koa';
import { ExportProcessor } from '../services/export-processor';
import type { ExportOptions } from '../types';

/**
 * POST /api/export
 * Body: { collection, fields?, filter?, sort?, limit? }
 * Returns CSV file as attachment.
 */
export async function exportAction(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const body = (ctx as any).request?.body || (ctx as any).action?.params?.values || {};

  const { collection, fields, filter, sort, limit } = body;

  if (!collection) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'collection is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const options: ExportOptions = {
    collection,
    fields: Array.isArray(fields) ? fields : undefined,
    filter,
    sort: Array.isArray(sort) ? sort : undefined,
    limit: limit ? Number(limit) : undefined,
  };

  const processor = new ExportProcessor(db);

  try {
    const { csv, totalRows } = await processor.exportToCsv(options);
    const filename = `${collection}-export-${Date.now()}.csv`;

    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition', `attachment; filename="${filename}"`);
    ctx.set('X-Total-Rows', String(totalRows));
    ctx.body = csv;
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: err.message, code: 'EXPORT_ERROR' }] };
    return;
  }

  await next();
}
