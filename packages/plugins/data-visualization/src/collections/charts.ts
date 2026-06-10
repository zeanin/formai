import { CollectionOptions } from '@formai/shared';

export const chartsCollection: CollectionOptions = {
  name: 'charts',
  title: 'Charts',
  fields: [
    { name: 'title', type: 'string', allowNull: false },
    { name: 'type', type: 'string', allowNull: false },
    { name: 'collection', type: 'string', allowNull: false },
    { name: 'config', type: 'jsonb', defaultValue: {} },
    { name: 'createdById', type: 'integer', allowNull: true },
  ],
  indexes: [
    { fields: ['type'], name: 'idx_charts_type' },
    { fields: ['collection'], name: 'idx_charts_collection' },
    { fields: ['createdById'], name: 'idx_charts_created_by' },
  ],
};
