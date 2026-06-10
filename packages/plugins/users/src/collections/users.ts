import { CollectionOptions } from '@formai/shared';

export const usersCollection: CollectionOptions = {
  name: 'users',
  title: 'Users',
  fields: [
    { name: 'username', type: 'string', unique: true, allowNull: false },
    { name: 'email', type: 'string', unique: true, allowNull: true },
    { name: 'phone', type: 'string', unique: true, allowNull: true },
    { name: 'nickname', type: 'string', allowNull: true },
    { name: 'password', type: 'password', allowNull: false },
    { name: 'status', type: 'enum', values: ['active', 'inactive', 'banned'], defaultValue: 'active' },
    { name: 'role', type: 'string', defaultValue: 'member', allowNull: false },
    { name: 'createdById', type: 'integer', allowNull: true },
    { name: 'updatedById', type: 'integer', allowNull: true },
  ],
  indexes: [
    { fields: ['username'], unique: true, name: 'uq_users_username' },
    { fields: ['email'], unique: true, name: 'uq_users_email' },
  ],
};
