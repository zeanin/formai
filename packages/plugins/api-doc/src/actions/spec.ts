import { Context, Next } from 'koa';
import { OpenApiGenerator } from '../services/openapi-generator';

/**
 * GET /api/doc/spec.json
 * Returns the OpenAPI 3.0 spec as JSON.
 */
export async function specAction(ctx: Context, next: Next): Promise<void> {
  const app = (ctx as any).app;
  const db = app.db;
  const resourcer = app.resourcer;

  const generator = new OpenApiGenerator(db, resourcer);
  const spec = generator.generate();

  ctx.set('Content-Type', 'application/json');
  ctx.body = spec;
  await next();
}
