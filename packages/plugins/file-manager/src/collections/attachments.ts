import { CollectionOptions } from '@formai/shared';

export const attachmentsCollection: CollectionOptions = {
  name: 'attachments',
  title: 'Attachments',
  fields: [
    { name: 'filename', type: 'string', allowNull: false },
    { name: 'path', type: 'string', allowNull: false },
    { name: 'mimetype', type: 'string', allowNull: false },
    { name: 'size', type: 'integer', allowNull: false },
    { name: 'storageType', type: 'string', defaultValue: 'local' },
    { name: 'url', type: 'string', allowNull: true },
    { name: 'createdById', type: 'integer', allowNull: true },
  ],
  indexes: [
    { fields: ['createdById'], name: 'idx_attachments_created_by' },
  ],
};
