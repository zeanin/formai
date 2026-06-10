import type { CollectionOptions } from '@formai/shared';

/**
 * skill_execution_logs — Audit log recording each AI Skill invocation
 * Used to track what AI did, who triggered it, and the outcome.
 */
export const skillExecutionLogsCollection: CollectionOptions = {
  name: 'skill_execution_logs',
  title: 'Skill Execution Logs',
  tableName: 'skill_execution_logs',
  fields: [
    { name: 'skillName',    type: 'string', allowNull: false, comment: 'Name of the invoked skill' },
    { name: 'skillTitle',   type: 'string', comment: 'Display title of the skill (snapshot)' },
    { name: 'userId',       type: 'integer', allowNull: true, comment: 'ID of the user who triggered the execution' },
    { name: 'userRoles',    type: 'jsonb',  defaultValue: [], comment: 'List of user roles at the time of execution (snapshot)' },
    { name: 'appId',        type: 'integer', allowNull: true, comment: 'App ID to which it belongs' },
    { name: 'inputArgs',    type: 'jsonb',  defaultValue: {}, comment: 'Input arguments provided by the AI' },
    { name: 'output',       type: 'jsonb',  defaultValue: null, allowNull: true, comment: 'Execution output/result' },
    { name: 'status',       type: 'string', defaultValue: 'success', comment: 'success | error | pending_confirm | confirmed | cancelled' },
    { name: 'errorMessage', type: 'text',   allowNull: true, comment: 'Error message (when status = error)' },
    { name: 'durationMs',   type: 'integer', allowNull: true, comment: 'Execution duration (milliseconds)' },
    { name: 'sessionId',    type: 'string', allowNull: true, comment: 'AI conversation Session ID' },
    { name: 'confirmationId', type: 'string', allowNull: true, comment: 'Associated confirmation ID (when requiresConfirm is true)' },
  ],
  indexes: [
    { fields: ['skillName'],  name: 'idx_skill_logs_skill' },
    { fields: ['userId'],     name: 'idx_skill_logs_user' },
    { fields: ['appId'],      name: 'idx_skill_logs_app' },
    { fields: ['createdAt'],  name: 'idx_skill_logs_time' },
    { fields: ['sessionId'],  name: 'idx_skill_logs_session' },
  ],
  timestamps: true,
  paranoid: false,
};

