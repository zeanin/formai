import { CollectionOptions } from '@formai/shared';

export const rolesCollection: CollectionOptions = {
  name: 'roles',
  title: 'Roles',
  fields: [
    { name: 'name', type: 'string', unique: true, allowNull: false },
    { name: 'title', type: 'string', allowNull: true },
    { name: 'strategy', type: 'string', defaultValue: 'denyAll' },
    { name: 'snippets', type: 'jsonb', defaultValue: [] },
  ],
  indexes: [
    { fields: ['name'], unique: true, name: 'uq_roles_name' },
  ],
};

export const roleUsersCollection: CollectionOptions = {
  name: 'roleUsers',
  title: 'Role Users',
  tableName: 'role_users',
  fields: [
    { name: 'roleId', type: 'integer', allowNull: false },
    { name: 'userId', type: 'integer', allowNull: false },
  ],
  indexes: [
    { fields: ['roleId', 'userId'], unique: true, name: 'uq_role_users' },
  ],
};

export const roleResourcesCollection: CollectionOptions = {
  name: 'roleResources',
  title: 'Role Resources',
  tableName: 'role_resources',
  fields: [
    { name: 'roleId', type: 'integer', allowNull: false },
    { name: 'resource', type: 'string', allowNull: false },
    { name: 'appId', type: 'string', allowNull: true },  // null = platform-level permission
    { name: 'actions', type: 'jsonb', defaultValue: {} },
  ],
  indexes: [
    { fields: ['roleId', 'resource', 'appId'], unique: true, name: 'uq_role_resources' },
    { fields: ['appId'], name: 'idx_role_resources_app' },
  ],
};
