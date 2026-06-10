import { Context, Next } from 'koa';

/**
 * Middleware that parses query parameters and request body into
 * standardised action params, attaching them to ctx.action.params.
 *
 * Handles:
 *   - filter      → parsed from JSON string if needed
 *   - fields      → comma-separated string → string[]
 *   - appends     → comma-separated string → string[]
 *   - except      → comma-separated string → string[]
 *   - sort        → comma-separated string → string[]
 *   - page        → number
 *   - pageSize    → number
 *   - filterByTk  → value from query
 *   Body values merged for POST / PUT / PATCH
 */
export async function actionParams(ctx: Context, next: Next): Promise<void> {
  const query = ctx.query as Record<string, string | string[]>;

  const parseJSON = (val: string | string[] | undefined): any => {
    if (!val) return undefined;
    const str = Array.isArray(val) ? val[0] : val;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const parseArray = (val: string | string[] | undefined): string[] | undefined => {
    if (!val) return undefined;
    if (Array.isArray(val)) return val;
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  };

  const parseNumber = (val: string | string[] | undefined, defaultVal?: number): number | undefined => {
    if (val === undefined) return defaultVal;
    const num = Number(Array.isArray(val) ? val[0] : val);
    return isNaN(num) ? defaultVal : num;
  };

  // Parse standard filter (JSON string or object) if present
  let filter = parseJSON(query['filter'] as string);
  if (!filter || typeof filter !== 'object') {
    filter = {};
  }

  // Also support flat query parameters like filter[resourceType]=collection
  for (const [key, val] of Object.entries(query)) {
    const match = key.match(/^filter\[([^\]]+)\]$/);
    if (match) {
      const field = match[1];
      filter[field] = Array.isArray(val) ? val[0] : val;
    }
  }

  const params: Record<string, any> = {
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    fields: parseArray(query['fields'] as string),
    appends: parseArray(query['appends'] as string),
    except: parseArray(query['except'] as string),
    sort: parseArray(query['sort'] as string),
    page: parseNumber(query['page'] as string, undefined),
    pageSize: parseNumber(query['pageSize'] as string, undefined),
    filterByTk: query['filterByTk'],
    appId: query['appId'],
  };

  // Remove undefined keys to keep params clean
  for (const key of Object.keys(params)) {
    if (params[key] === undefined) delete params[key];
  }

  // Merge request body for mutating HTTP methods
  const method = ctx.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method) && ctx.request.body) {
    const body = ctx.request.body as Record<string, any>;
    // Body `values` key is the canonical place for write data
    if (body['values']) {
      params['values'] = body['values'];
    } else if (Object.keys(body).length) {
      // Treat entire body as values if no explicit wrapper
      params['values'] = body;
    }
  }

  // Ensure ctx.action exists and merge params
  (ctx as any).action = (ctx as any).action ?? {
    resourceName: '',
    actionName: '',
    params: {},
  };
  (ctx as any).action.params = {
    ...(ctx as any).action.params,
    ...params,
  };

  await next();
}
