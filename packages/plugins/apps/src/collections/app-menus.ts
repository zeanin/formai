import { CollectionOptions } from '@formai/shared';

export const appMenusCollection: CollectionOptions = {
  name: 'appMenus',
  title: 'App Menus',
  tableName: 'app_menus',
  fields: [
    { name: 'appId', type: 'integer', allowNull: false },
    { name: 'title', type: 'string', allowNull: false },
    { name: 'icon', type: 'string', allowNull: true },
    { name: 'type', type: 'string', defaultValue: 'page' },  // page | link | group
    { name: 'schemaUid', type: 'string', allowNull: true },  // FK to uiSchemas.uid
    { name: 'url', type: 'string', allowNull: true },         // for external links
    { name: 'parentId', type: 'integer', allowNull: true },   // self-referential
    { name: 'sort', type: 'integer', defaultValue: 0 },
    { name: 'permissionKey', type: 'string', allowNull: true }, // e.g. "crm.orders.view"
    { name: 'path', type: 'string', allowNull: true },          // URL slug "orders"
    { name: 'hidden', type: 'boolean', defaultValue: false },
  ],
  indexes: [
    { fields: ['appId'], name: 'idx_app_menus_app' },
    { fields: ['appId', 'path'], name: 'idx_app_menus_path' },
    { fields: ['parentId'], name: 'idx_app_menus_parent' },
  ],
};

export const appRolesCollection: CollectionOptions = {
  name: 'appRoles',
  title: 'App Roles',
  tableName: 'app_roles',
  fields: [
    { name: 'appId', type: 'integer', allowNull: false },
    { name: 'name', type: 'string', allowNull: false },   // "manager" | "sales"
    { name: 'title', type: 'string', allowNull: false },
    { name: 'permissions', type: 'jsonb', defaultValue: [] }, // array of permissionKeys
    { name: 'isDefault', type: 'boolean', defaultValue: false },
  ],
  indexes: [
    { fields: ['appId', 'name'], unique: true, name: 'uq_app_roles_app_name' },
  ],
};

export const userAppRolesCollection: CollectionOptions = {
  name: 'userAppRoles',
  title: 'User App Role Assignments',
  tableName: 'user_app_roles',
  fields: [
    { name: 'userId', type: 'integer', allowNull: false },
    { name: 'appRoleId', type: 'integer', allowNull: false },
    { name: 'appId', type: 'integer', allowNull: false }, // denormalized for fast lookup
  ],
  indexes: [
    { fields: ['userId', 'appRoleId'], unique: true, name: 'uq_user_app_roles' },
    { fields: ['userId', 'appId'], name: 'idx_user_app_roles_user_app' },
  ],
};
