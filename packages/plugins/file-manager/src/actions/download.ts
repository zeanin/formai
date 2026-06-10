import { Context, Next } from 'koa';
import { StorageEngine } from '../storage/base';

/**
 * File download action.
 * Serves a file by its attachment record id.
 */
export function createDownloadAction(storageEngine: StorageEngine) {
  return async (ctx: Context, next: Next): Promise<void> => {
    const { filterByTk } = (ctx as any).action.params;

    if (!filterByTk) {
      ctx.status = 400;
      ctx.body = { errors: [{ message: 'Attachment id is required', code: 'VALIDATION_ERROR' }] };
      return;
    }

    const repo = (ctx as any).app.db.getRepository('attachments');
    const attachment = await repo.findById(filterByTk);

    if (!attachment) {
      ctx.status = 404;
      ctx.body = { errors: [{ message: 'Attachment not found', code: 'NOT_FOUND' }] };
      return;
    }

    try {
      const data = await storageEngine.read(attachment.path);

      ctx.set('Content-Type', attachment.mimetype);
      ctx.set('Content-Length', String(data.length));
      ctx.set('Content-Disposition', `inline; filename="${attachment.filename}"`);
      ctx.body = data;
    } catch (err: any) {
      ctx.status = 404;
      ctx.body = { errors: [{ message: 'File not found on storage', code: 'FILE_NOT_FOUND' }] };
    }

    await next();
  };
}
