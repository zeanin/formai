import { CollectionOptions } from '@formai/shared';

export const workflowsCollection: CollectionOptions = {
  name: 'workflows',
  title: 'Workflows',
  fields: [
    { name: 'id', type: 'uuid', primaryKey: true, defaultValue: 'UUIDV4' },
    { name: 'title', type: 'string', allowNull: false },
    { name: 'description', type: 'text', allowNull: true },
    { name: 'appId', type: 'integer', allowNull: true },  // null = platform-level workflow
    { name: 'enabled', type: 'boolean', defaultValue: false },
    { name: 'triggerType', type: 'string', allowNull: false },
    { name: 'triggerConfig', type: 'jsonb', defaultValue: {} },
    { name: 'nodes', type: 'jsonb', defaultValue: [] },
    { name: 'createdById', type: 'integer', allowNull: true },
  ],
};
