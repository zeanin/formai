import { CollectionOptions } from '@formai/shared';

export const uiSchemasCollection: CollectionOptions = {
  name: 'uiSchemas',
  title: 'UI Schemas',
  tableName: 'ui_schemas',
  fields: [
    { name: 'uid', type: 'string', unique: true, allowNull: false, primaryKey: true },
    { name: 'title', type: 'string', allowNull: true },
    { name: 'appId', type: 'string', allowNull: false },  // every schema belongs to an app
    { name: 'schema', type: 'jsonb', defaultValue: {} },
    { name: 'parentUid', type: 'string', allowNull: true },
    { name: 'sort', type: 'integer', defaultValue: 0 },
  ],
  indexes: [
    { fields: ['uid'], unique: true, name: 'uq_ui_schemas_uid' },
    { fields: ['parentUid'], name: 'idx_ui_schemas_parent' },
    { fields: ['appId'], name: 'idx_ui_schemas_app' },
  ],
};

export const uiSchemaVersionsCollection: CollectionOptions = {
  name: 'uiSchemaVersions',
  title: 'UI Schema Versions',
  tableName: 'ui_schema_versions',
  fields: [
    { name: 'uid', type: 'string', allowNull: false },
    { name: 'version', type: 'integer', allowNull: false, defaultValue: 1 },
    { name: 'schema', type: 'jsonb', defaultValue: {} },
  ],
  indexes: [
    { fields: ['uid', 'version'], unique: true, name: 'uq_ui_schema_versions' },
  ],
};
