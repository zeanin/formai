import { CollectionOptions } from '@formai/shared';

export const auditLogsCollection: CollectionOptions = {
  name: 'auditLogs',
  title: 'Audit Logs',
  tableName: 'audit_logs',
  fields: [
    { name: 'userId', type: 'integer', allowNull: true },
    { name: 'username', type: 'string', allowNull: true },
    { name: 'resource', type: 'string', allowNull: false },
    { name: 'action', type: 'string', allowNull: false },
    { name: 'collectionName', type: 'string', allowNull: true },
    { name: 'recordId', type: 'string', allowNull: true },
    { name: 'changes', type: 'jsonb', allowNull: true },
    { name: 'ip', type: 'string', allowNull: true },
    { name: 'userAgent', type: 'text', allowNull: true },
  ],
  indexes: [
    { fields: ['userId'], name: 'idx_audit_logs_user_id' },
    { fields: ['resource', 'action'], name: 'idx_audit_logs_resource_action' },
    { fields: ['collectionName'], name: 'idx_audit_logs_collection' },
    { fields: ['createdAt'], name: 'idx_audit_logs_created_at' },
  ],
};
