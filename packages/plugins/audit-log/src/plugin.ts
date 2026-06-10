import { Plugin } from '@formai/plugin';
import { auditLogsCollection } from './collections/audit-logs';
import * as logActions from './actions/logs';
import { auditMiddleware } from './middleware/audit';

export default class AuditLogPlugin extends Plugin {
  async load(): Promise<void> {
    this.defineCollection(auditLogsCollection);

    // Register the audit middleware so all mutating actions are logged
    this.addMiddleware(auditMiddleware(this.db));

    this.registerResource({
      name: 'auditLogs',
      actions: {
        list: logActions.list,
        get: logActions.get,
      },
    });
  }

  async install(): Promise<void> {
    // No seed data required
  }
}
