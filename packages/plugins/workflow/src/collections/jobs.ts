import { CollectionOptions } from '@formai/shared';

export const jobsCollection: CollectionOptions = {
  name: 'jobs',
  title: 'Workflow Jobs',
  fields: [
    { name: 'id', type: 'uuid', primaryKey: true, defaultValue: 'UUIDV4' },
    { name: 'executionId', type: 'uuid', allowNull: false },
    { name: 'nodeId', type: 'string', allowNull: false },
    {
      name: 'status',
      type: 'enum',
      values: ['pending', 'resolved', 'rejected', 'cancelled', 'error'],
      defaultValue: 'pending',
    },
    { name: 'result', type: 'jsonb', allowNull: true },
    { name: 'upstreamId', type: 'string', allowNull: true },
    // executionId links to executions (handled via filter)
  ],
};
