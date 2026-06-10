import { Plugin } from '@formai/plugin';
import { backupsCollection } from './collections/backups';
import { backupAction } from './actions/backup';
import { restoreAction } from './actions/restore';
import { listAction, getAction, destroyAction } from './actions/list';

export default class BackupRestorePlugin extends Plugin {
  async load(): Promise<void> {
    this.defineCollection(backupsCollection);

    this.registerResource({
      name: 'backups',
      actions: {
        list: listAction,
        get: getAction,
        destroy: destroyAction,
        backup: backupAction,
        restore: restoreAction,
      },
    });
  }

  async install(): Promise<void> {
    // No seed data required
  }
}
