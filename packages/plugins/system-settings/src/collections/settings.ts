import { CollectionOptions } from '@formai/shared';

export const settingsCollection: CollectionOptions = {
  name: 'systemSettings',
  title: 'System Settings',
  tableName: 'system_settings',
  fields: [
    { name: 'key', type: 'string', unique: true, allowNull: false },
    { name: 'value', type: 'jsonb', defaultValue: null },
    { name: 'group', type: 'string', defaultValue: 'general' },
  ],
  indexes: [
    { fields: ['key'], unique: true, name: 'uq_system_settings_key' },
    { fields: ['group'], name: 'idx_system_settings_group' },
  ],
};
