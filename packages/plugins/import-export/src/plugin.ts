import { Plugin } from '@formai/plugin';
import { importJobsCollection } from './collections/import-jobs';
import { importAction, getJob, listJobs } from './actions/import';
import { exportAction } from './actions/export';

export default class ImportExportPlugin extends Plugin {
  async load(): Promise<void> {
    this.defineCollection(importJobsCollection);

    // Import jobs resource
    this.registerResource({
      name: 'importJobs',
      actions: {
        list: listJobs,
        get: getJob,
        import: importAction,
      },
    });

    // Export resource (stateless, no collection backing)
    this.registerResource({
      name: 'export',
      actions: {
        export: exportAction,
      },
    });
  }

  async install(): Promise<void> {
    // No seed data required
  }
}
