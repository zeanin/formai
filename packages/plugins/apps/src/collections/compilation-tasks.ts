import { CollectionOptions } from '@formai/shared';

export const compilationTasksCollection: CollectionOptions = {
  name: 'compilationTasks',
  title: 'Compilation Tasks',
  tableName: 'compilation_tasks',
  fields: [
    { name: 'appId', type: 'integer', allowNull: false },
    { name: 'blueprint', type: 'text', allowNull: false },
    { name: 'status', type: 'string', defaultValue: 'pending' }, // pending | processing | completed | failed
    { name: 'logs', type: 'jsonb', defaultValue: [] },           // array of log strings: string[]
    { name: 'error', type: 'text', allowNull: true },
    { name: 'startedAt', type: 'date', allowNull: true },
    { name: 'finishedAt', type: 'date', allowNull: true },
  ],
  indexes: [
    { fields: ['appId'], name: 'idx_compilation_tasks_app' },
    { fields: ['status'], name: 'idx_compilation_tasks_status' },
  ],
};
