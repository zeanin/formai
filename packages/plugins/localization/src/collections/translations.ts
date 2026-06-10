import { CollectionOptions } from '@formai/shared';

export const translationsCollection: CollectionOptions = {
  name: 'translations',
  title: 'Translations',
  tableName: 'translations',
  fields: [
    { name: 'locale', type: 'string', allowNull: false },
    { name: 'namespace', type: 'string', defaultValue: 'common' },
    { name: 'key', type: 'string', allowNull: false },
    { name: 'value', type: 'text', allowNull: true },
  ],
  indexes: [
    { fields: ['locale', 'namespace', 'key'], unique: true, name: 'uq_translations_locale_ns_key' },
    { fields: ['locale'], name: 'idx_translations_locale' },
  ],
};
