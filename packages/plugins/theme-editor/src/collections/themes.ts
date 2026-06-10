import { CollectionOptions } from '@formai/shared';

export const themesCollection: CollectionOptions = {
  name: 'themes',
  title: 'Themes',
  fields: [
    { name: 'name', type: 'string', allowNull: false, unique: true },
    { name: 'config', type: 'jsonb', defaultValue: {} },
    { name: 'isDefault', type: 'boolean', defaultValue: false },
    { name: 'createdById', type: 'integer', allowNull: true },
  ],
  indexes: [
    { fields: ['name'], unique: true, name: 'uq_themes_name' },
    { fields: ['isDefault'], name: 'idx_themes_is_default' },
  ],
};
