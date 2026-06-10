import { Context, Next } from 'koa';
import { SwaggerUi } from '../services/swagger-ui';

/**
 * GET /api/doc
 * Serves the Swagger UI HTML page.
 */
export async function uiAction(ctx: Context, next: Next): Promise<void> {
  const swaggerUi = new SwaggerUi();
  // Build the spec URL relative to the current host
  const host = ctx.request.origin || '';
  const specUrl = `${host}/api/doc/spec.json`;

  ctx.set('Content-Type', 'text/html; charset=utf-8');
  ctx.body = swaggerUi.generateHtml(specUrl);
  await next();
}
