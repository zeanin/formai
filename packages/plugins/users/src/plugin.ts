import { Plugin } from '@formai/plugin';
import { usersCollection } from './collections/users';
import * as userActions from './actions/users';
import { Context, Next } from 'koa';

/**
 * Middleware that auto-populates createdById / updatedById from the current user.
 */
function createdByMiddleware() {
  return async (ctx: Context & { state: any; action: any }, next: Next) => {
    const currentUser = ctx.state?.currentUser;
    if (currentUser) {
      const { actionName } = ctx.action || {};
      if (actionName === 'create' && ctx.action.params?.values) {
        ctx.action.params.values.createdById = currentUser.id;
        ctx.action.params.values.updatedById = currentUser.id;
      }
      if (actionName === 'update' && ctx.action.params?.values) {
        ctx.action.params.values.updatedById = currentUser.id;
      }
    }
    await next();
  };
}

export default class UsersPlugin extends Plugin {
  async load(): Promise<void> {
    // Register the users collection
    this.defineCollection(usersCollection);

    // Register the users resource with custom actions
    this.registerResource({
      name: 'users',
      actions: {
        register: userActions.register,
        profile: userActions.profile,
        updateProfile: userActions.updateProfile,
      },
      middlewares: [createdByMiddleware()],
    });

    // Add the created_by / updated_by auto-population middleware globally
    this.addMiddleware(createdByMiddleware());
  }

  async install(): Promise<void> {
    // Create default root user if no users exist
    const repo = this.db.getRepository('users');
    const count = await repo.count();
    if (count === 0) {
      const { hashPassword } = await import('@formai/auth');
      await repo.create({
        values: {
          username: 'root',
          nickname: 'Root',
          password: await hashPassword('admin123'),
          email: 'root@example.com',
          status: 'active',
          role: 'root',
        },
      });
    }
  }
}
