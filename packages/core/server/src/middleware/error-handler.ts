import { Context, Next } from 'koa';

export async function errorHandler(ctx: Context, next: Next): Promise<void> {
  try {
    await next();
  } catch (err: any) {
    ctx.status = err.status ?? err.statusCode ?? 500;
    ctx.body = {
      errors: [
        {
          message: err.message || 'Internal Server Error',
          code: err.code || 'INTERNAL_ERROR',
        },
      ],
    };
    ctx.app.emit('error', err, ctx);
  }
}
