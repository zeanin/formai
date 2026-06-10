import { Context, Next } from 'koa';
import { AggregationService } from '../services/aggregation';
import type { AggregationOptions } from '../types';

/**
 * Execute an aggregation query for chart data.
 * POST /api/charts/query
 * Body: AggregationOptions
 */
export async function query(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const body = (ctx as any).request?.body || (ctx as any).action?.params?.values || {};

  const options: AggregationOptions = {
    collection: body.collection,
    metrics: body.metrics || [],
    groupByField: body.groupByField,
    dateField: body.dateField,
    dateGrouping: body.dateGrouping,
    filters: body.filters,
    limit: body.limit,
    sort: body.sort,
    sortOrder: body.sortOrder,
  };

  if (!options.collection) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'collection is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  try {
    const service = new AggregationService(db);
    const rows = await service.query(options);
    ctx.body = {
      data: {
        rows,
        meta: {
          total: rows.length,
          executedAt: new Date().toISOString(),
        },
      },
    };
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: err.message, code: 'QUERY_ERROR' }] };
    return;
  }

  await next();
}

/**
 * Execute a saved chart's aggregation query.
 * GET /api/charts/:id/data
 */
export async function data(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk } = (ctx as any).action.params;

  const repo = db.getRepository('charts');
  const chart = await repo.findById(filterByTk);
  if (!chart) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Chart not found', code: 'NOT_FOUND' }] };
    return;
  }

  const config = chart.config || {};

  const options: AggregationOptions = {
    collection: chart.collection,
    metrics: config.metrics || [],
    groupByField: config.groupByField,
    dateField: config.dateField,
    dateGrouping: config.dateGrouping,
    filters: config.filters,
    limit: config.limit,
    sort: config.sort,
    sortOrder: config.sortOrder,
  };

  try {
    const service = new AggregationService(db);
    const rows = await service.query(options);
    ctx.body = {
      data: {
        rows,
        meta: {
          total: rows.length,
          executedAt: new Date().toISOString(),
        },
      },
    };
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: err.message, code: 'QUERY_ERROR' }] };
    return;
  }

  await next();
}
