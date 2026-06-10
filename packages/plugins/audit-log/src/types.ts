export interface AuditLogEntry {
  userId?: number;
  username?: string;
  resource: string;
  action: string;
  collectionName?: string;
  recordId?: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  ip?: string;
  userAgent?: string;
}

/** Actions that should be audited */
export const AUDITED_ACTIONS = new Set(['create', 'update', 'destroy', 'updateMany', 'destroyMany']);
