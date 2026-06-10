import { Context, Next } from 'koa';

/**
 * Wraps ctx.body in a standard { data } envelope after handlers run,
 * unless the body is already wrapped (has a `data` or `errors` key at the top level).
 */
export async function dataWrapping(ctx: Context, next: Next): Promise<void> {
  await next();

  // Nothing to wrap
  if (ctx.body === undefined || ctx.body === null) return;

  // Already wrapped — skip
  if (
    typeof ctx.body === 'object' &&
    ('data' in (ctx.body as object) || 'errors' in (ctx.body as object))
  ) {
    return;
  }

  ctx.body = { data: ctx.body };
}
