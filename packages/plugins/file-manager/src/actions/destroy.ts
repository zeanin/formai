import { Context, Next } from 'koa';
import { StorageEngine } from '../storage/base';

/**
 * File destroy action.
 * Deletes file(s) from storage and the database.
 */
export function createDestroyAction(storageEngine: StorageEngine) {
  return async (ctx: Context, next: Next): Promise<void> => {
    const repo = (ctx as any).app.db.getRepository('attachments');
    const { filterByTk } = (ctx as any).action.params;

    if (!filterByTk) {
      ctx.status = 400;
      ctx.body = { errors: [{ message: 'Attachment ID is required', code: 'VALIDATION_ERROR' }] };
      return;
    }

    const attachment = await repo.findById(filterByTk);
    if (!attachment) {
      ctx.status = 404;
      ctx.body = { errors: [{ message: 'Attachment not found', code: 'NOT_FOUND' }] };
      return;
    }

    try {
      // Delete from storage disk
      await storageEngine.delete(attachment.path);
      // Delete from database
      const count = await repo.destroy({ filterByTk });
      ctx.body = { data: count };
    } catch (err: any) {
      ctx.status = 500;
      ctx.body = { errors: [{ message: `Delete failed: ${err.message}`, code: 'DELETE_ERROR' }] };
      return;
    }

    await next();
  };
}
