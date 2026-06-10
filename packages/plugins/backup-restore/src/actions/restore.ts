import { Context, Next } from 'koa';
import { BackupService } from '../services/backup-service';
import { join } from 'path';

/**
 * POST /api/backups/:id/restore
 * Body: { confirm: true }
 */
export async function restoreAction(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk } = (ctx as any).action.params;
  const body = (ctx as any).request?.body || (ctx as any).action?.params?.values || {};

  if (!body.confirm) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'confirm: true is required to proceed with restore', code: 'CONFIRMATION_REQUIRED' }] };
    return;
  }

  const repo = db.getRepository('backups');
  const backup = await repo.findById(filterByTk);

  if (!backup) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Backup not found', code: 'NOT_FOUND' }] };
    return;
  }

  if (backup.status !== 'completed') {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'Cannot restore from a non-completed backup', code: 'INVALID_STATE' }] };
    return;
  }

  if (backup.type !== 'full') {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'Restore is only supported for full backups', code: 'UNSUPPORTED_TYPE' }] };
    return;
  }

  const storageDir = join(process.cwd(), 'storage', 'backups');
  const service = new BackupService({ db, storageDir });

  try {
    await service.restoreFull(backup.storagePath);
    ctx.body = { data: { message: 'Restore completed successfully', backupId: backup.id } };
  } catch (err: any) {
    ctx.status = 500;
    ctx.body = { errors: [{ message: `Restore failed: ${err.message}`, code: 'RESTORE_ERROR' }] };
    return;
  }

  await next();
}
