import { CollectionOptions } from '@formai/shared';

export const appsCollection: CollectionOptions = {
  name: 'apps',
  title: 'Applications',
  tableName: 'apps',
  fields: [
    { name: 'name', type: 'string', unique: true, allowNull: false },
    { name: 'title', type: 'string', allowNull: false },
    { name: 'description', type: 'text', allowNull: true },
    { name: 'status', type: 'string', defaultValue: 'draft' }, // draft | published | archived
    { name: 'icon', type: 'string', allowNull: true },
    { name: 'basePath', type: 'string', allowNull: true },     // "/apps/crm"
    { name: 'createdById', type: 'integer', allowNull: true },
    { name: 'settings', type: 'jsonb', defaultValue: {} },
    { name: 'blueprint', type: 'text', allowNull: true },
  ],
  indexes: [
    { fields: ['name'], unique: true, name: 'uq_apps_name' },
    { fields: ['status'], name: 'idx_apps_status' },
  ],
};
