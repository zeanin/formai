import type { CollectionOptions } from '@formai/shared';

/**
 * resource_skills metadata collection
 * Persistently stores all AI Skills definitions bound to resources.
 */
export const resourceSkillsCollection: CollectionOptions = {
  name: 'resource_skills',
  title: 'Resource AI Skills',
  tableName: 'resource_skills_meta',
  fields: [
    // Unique identifier
    { name: 'name', type: 'string', allowNull: false, comment: 'Unique name of the skill, e.g., orders_cancel' },
    { name: 'title', type: 'string', allowNull: false, comment: 'Display title, e.g., Cancel Order' },
    { name: 'description', type: 'text', allowNull: false, comment: 'Description read by the AI, which affects routing accuracy' },

    // Bound resource
    { name: 'resourceType', type: 'string', allowNull: false, comment: 'collection | page | workflow | role | menu' },
    { name: 'resourceName', type: 'string', allowNull: false, comment: 'Name of the bound resource' },
    { name: 'appId', type: 'integer', allowNull: true, comment: 'App ID to which it belongs, null = global' },

    // Schema & Configuration
    { name: 'inputSchema', type: 'jsonb', allowNull: false, defaultValue: { type: 'object', properties: {} }, comment: 'JSON Schema of input parameters' },
    { name: 'skillType', type: 'string', allowNull: false, defaultValue: 'auto', comment: 'auto | custom' },
    { name: 'handler', type: 'jsonb', allowNull: false, defaultValue: {}, comment: 'Executor configuration' },

    // Control options
    { name: 'enabled', type: 'boolean', defaultValue: false, comment: 'Whether it is enabled' },
    { name: 'requiresConfirm', type: 'boolean', defaultValue: false, comment: 'Whether user confirmation is required before execution' },
    { name: 'rolesAllowed', type: 'jsonb', defaultValue: [], comment: 'List of allowed roles, empty = all roles' },
    { name: 'options', type: 'jsonb', defaultValue: {}, comment: 'Extension options' },
  ],
  indexes: [
    { fields: ['resourceType', 'resourceName'], name: 'idx_resource_skills_resource' },
    { fields: ['appId'], name: 'idx_resource_skills_app' },
    { fields: ['name'], unique: true, name: 'uq_resource_skills_name' },
  ],
  timestamps: true,
};

