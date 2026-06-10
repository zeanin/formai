import { Context, Next } from 'koa';
import { CsvParser } from '../services/csv-parser';
import { ImportProcessor } from '../services/import-processor';

/**
 * POST /api/importJobs/import
 * Body: { collection, filename, csvContent, fieldMap? }
 */
export async function importAction(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const body = (ctx as any).request?.body || (ctx as any).action?.params?.values || {};

  const { collection, filename, csvContent, fieldMap } = body;

  if (!collection || !csvContent) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'collection and csvContent are required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const userId = (ctx as any).state?.currentUser?.id;
  const jobsRepo = db.getRepository('importJobs');

  // Parse CSV
  const parser = new CsvParser();
  let parsed: ReturnType<CsvParser['parse']>;
  try {
    parsed = parser.parse(csvContent);
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: `CSV parse error: ${err.message}`, code: 'PARSE_ERROR' }] };
    return;
  }

  // Create job record
  const job = await jobsRepo.create({
    values: {
      collection,
      filename: filename || 'import.csv',
      status: 'processing',
      totalRows: parsed.rows.length,
      processedRows: 0,
      errors: [],
      createdById: userId,
    },
  });

  // Process asynchronously (fire and forget for large datasets)
  const processor = new ImportProcessor(db);
  setImmediate(async () => {
    try {
      let processedRows = 0;
      const errors = await processor.process(
        { collection, headers: parsed.headers, data: parsed.rows, fieldMap },
        async (count) => {
          processedRows = count;
          // Update progress every 100 rows
          if (count % 100 === 0) {
            await jobsRepo.update({ filter: { id: job.id }, values: { processedRows: count } });
          }
        },
      );

      await jobsRepo.update({
        filter: { id: job.id },
        values: {
          status: errors.length > 0 ? 'completed' : 'completed',
          processedRows,
          errors,
        },
      });
    } catch (err: any) {
      await jobsRepo.update({
        filter: { id: job.id },
        values: { status: 'failed', errors: [{ row: 0, message: err.message }] },
      });
    }
  });

  ctx.status = 202;
  ctx.body = { data: job };
  await next();
}

/**
 * GET /api/importJobs/:id
 */
export async function getJob(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk } = (ctx as any).action.params;
  const repo = db.getRepository('importJobs');
  const job = await repo.findById(filterByTk);
  if (!job) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Import job not found', code: 'NOT_FOUND' }] };
    return;
  }
  ctx.body = { data: job };
  await next();
}

/**
 * GET /api/importJobs
 */
export async function listJobs(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filter, sort, page = 1, pageSize = 20 } = (ctx as any).action.params;
  const repo = db.getRepository('importJobs');
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
