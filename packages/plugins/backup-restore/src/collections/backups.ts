import { CollectionOptions } from '@formai/shared';

export const backupsCollection: CollectionOptions = {
  name: 'backups',
  title: 'Backups',
  fields: [
    { name: 'filename', type: 'string', allowNull: false },
    { name: 'size', type: 'integer', defaultValue: 0 },
    { name: 'type', type: 'string', allowNull: false },       // 'full' | 'config'
    { name: 'status', type: 'string', defaultValue: 'pending' }, // 'pending' | 'completed' | 'failed'
    { name: 'storagePath', type: 'string', allowNull: true },
    { name: 'notes', type: 'text', allowNull: true },
  ],
  indexes: [
    { fields: ['type'], name: 'idx_backups_type' },
    { fields: ['status'], name: 'idx_backups_status' },
    { fields: ['createdAt'], name: 'idx_backups_created_at' },
  ],
};
