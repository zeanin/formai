import { CollectionOptions } from '@formai/shared';

export const importJobsCollection: CollectionOptions = {
  name: 'importJobs',
  title: 'Import Jobs',
  tableName: 'import_jobs',
  fields: [
    { name: 'collection', type: 'string', allowNull: false },
    { name: 'status', type: 'string', defaultValue: 'pending' },
    { name: 'filename', type: 'string', allowNull: false },
    { name: 'totalRows', type: 'integer', defaultValue: 0 },
    { name: 'processedRows', type: 'integer', defaultValue: 0 },
    { name: 'errors', type: 'jsonb', defaultValue: [] },
    { name: 'createdById', type: 'integer', allowNull: true },
  ],
  indexes: [
    { fields: ['status'], name: 'idx_import_jobs_status' },
    { fields: ['collection'], name: 'idx_import_jobs_collection' },
    { fields: ['createdById'], name: 'idx_import_jobs_created_by' },
  ],
};
