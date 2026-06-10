import type { AuditLogEntry } from '../types';

/**
 * Service for writing audit log entries to the database.
 */
export class LoggerService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const repo = this.db.getRepository('auditLogs');
      if (!repo) return;

      await repo.create({
        values: {
          userId: entry.userId,
          username: entry.username,
          resource: entry.resource,
          action: entry.action,
          collectionName: entry.collectionName,
          recordId: entry.recordId ? String(entry.recordId) : null,
          changes: entry.changes ?? null,
          ip: entry.ip,
          userAgent: entry.userAgent,
        },
      });
    } catch {
      // Audit log failures must never crash the main request
    }
  }
}
