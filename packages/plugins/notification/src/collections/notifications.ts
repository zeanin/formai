import { CollectionOptions } from '@formai/shared';

export const notificationsCollection: CollectionOptions = {
  name: 'notifications',
  title: 'Notifications',
  fields: [
    { name: 'userId', type: 'integer', allowNull: false, index: true },
    { name: 'title', type: 'string', allowNull: false },
    { name: 'content', type: 'text', allowNull: true },
    { name: 'type', type: 'string', defaultValue: 'info' },
    { name: 'read', type: 'boolean', defaultValue: false },
  ],
  indexes: [
    { fields: ['userId', 'read'], name: 'idx_notifications_user_read' },
    { fields: ['userId'], name: 'idx_notifications_user' },
  ],
};

export const notificationChannelsCollection: CollectionOptions = {
  name: 'notificationChannels',
  title: 'Notification Channels',
  tableName: 'notification_channels',
  fields: [
    { name: 'name', type: 'string', unique: true, allowNull: false },
    { name: 'type', type: 'string', allowNull: false },
    { name: 'config', type: 'jsonb', defaultValue: {} },
    { name: 'enabled', type: 'boolean', defaultValue: true },
  ],
  indexes: [
    { fields: ['name'], unique: true, name: 'uq_notification_channels_name' },
  ],
};
