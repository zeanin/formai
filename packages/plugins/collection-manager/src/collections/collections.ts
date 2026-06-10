import { CollectionOptions, FieldOptions } from '@formai/shared';

export const collectionsCollection: CollectionOptions = {
  name: 'collections',
  title: 'Collections',
  tableName: 'collections_meta',
  fields: [
    { name: 'name', type: 'string', unique: true, allowNull: false },
    { name: 'title', type: 'string' },
    { name: 'appId', type: 'string', allowNull: true },  // null = platform-shared, 'crm' = app-owned
    { name: 'options', type: 'jsonb', defaultValue: {} },
    {
      name: 'fields',
      type: 'hasMany',
      target: 'fields',
      foreignKey: 'collectionName',
      sourceKey: 'name',
    },
  ],
  indexes: [
    { fields: ['name'], unique: true, name: 'uq_collections_name' },
    { fields: ['appId'], name: 'idx_collections_app' },
  ],
};

export const fieldsCollection: CollectionOptions = {
  name: 'fields',
  title: 'Fields',
  tableName: 'fields_meta',
  fields: [
    { name: 'collectionName', type: 'string', allowNull: false },
    { name: 'name', type: 'string', allowNull: false },
    { name: 'type', type: 'string', allowNull: false },
    { name: 'options', type: 'jsonb', defaultValue: {} },
    { name: 'sort', type: 'integer', defaultValue: 0 },
    {
      name: 'collection',
      type: 'belongsTo',
      target: 'collections',
      foreignKey: 'collectionName',
      targetKey: 'name',
    },
  ],
  indexes: [
    { fields: ['collectionName', 'name'], unique: true, name: 'uq_fields_collection_name' },
  ],
};
