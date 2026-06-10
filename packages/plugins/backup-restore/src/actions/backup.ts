import { Context, Next } from 'koa';
import { BackupService } from '../services/backup-service';
import { join } from 'path';

function getBackupService(ctx: Context): BackupService {
  const db = (ctx as any).app.db;
  const storageDir = join(process.cwd(), 'storage', 'backups');
  return new BackupService({ db, storageDir });
}

/**
 * POST /api/backups/backup
 * Body: { type: 'full' | 'config', notes? }
 */
export async function backupAction(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const body = (ctx as any).request?.body || (ctx as any).action?.params?.values || {};
  const { type = 'full', notes } = body;

  if (type !== 'full' && type !== 'config') {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'type must be "full" or "config"', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const repo = db.getRepository('backups');
  const service = getBackupService(ctx);

  // Create pending record
  const record = await repo.create({
    values: { type, status: 'pending', filename: '', size: 0, notes: notes || null },
  });

  // Run backup asynchronously
  setImmediate(async () => {
    try {
      const result = type === 'full'
        ? await service.backupFull()
        : await service.backupConfig();

      await repo.update({
        filter: { id: record.id },
        values: {
          filename: result.filename,
          storagePath: result.storagePath,
          size: result.size,
          status: 'completed',
        },
      });
    } catch (err: any) {
      await repo.update({
        filter: { id: record.id },
        values: { status: 'failed', notes: err.message },
      });
    }
  });

  ctx.status = 202;
  ctx.body = { data: record };
  await next();
}
