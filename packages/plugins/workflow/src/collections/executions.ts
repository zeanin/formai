import { CollectionOptions } from '@formai/shared';

export const executionsCollection: CollectionOptions = {
  name: 'executions',
  title: 'Workflow Executions',
  fields: [
    { name: 'id', type: 'uuid', primaryKey: true, defaultValue: 'UUIDV4' },
    { name: 'workflowId', type: 'uuid', allowNull: false },
    {
      name: 'status',
      type: 'enum',
      values: ['started', 'resolved', 'rejected', 'cancelled', 'error'],
      defaultValue: 'started',
    },
    { name: 'context', type: 'jsonb', defaultValue: {} },
    // workflowId links to workflows (no ORM-level association; handled via filter)
  ],
};
