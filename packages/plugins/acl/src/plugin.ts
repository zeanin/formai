import { Plugin } from '@formai/plugin';
import { ACL, aclMiddleware } from '@formai/acl';
import { rolesCollection, roleUsersCollection, roleResourcesCollection } from './collections/roles';
import * as roleActions from './actions/roles';
import * as roleResourceActions from './actions/role-resources';

export default class AclPlugin extends Plugin {
  async load(): Promise<void> {
    // Ensure the app has an ACL instance
    if (!this.app.acl) {
      this.app.acl = new ACL();
    }

    // Register collections for persisting role/permission data
    this.defineCollection(rolesCollection);
    this.defineCollection(roleUsersCollection);
    this.defineCollection(roleResourcesCollection);

    // Register the ACL middleware
    this.addMiddleware(aclMiddleware(this.app.acl));

    // Register resource actions for roles
    this.registerResource({
      name: 'roles',
      actions: {
        list: roleActions.list,
        get: roleActions.get,
        create: roleActions.create,
        update: roleActions.update,
        destroy: roleActions.destroy,
        setUsers: roleActions.setUsers,
      },
    });

    // Register resource actions for role-resources (permissions)
    this.registerResource({
      name: 'roleResources',
      actions: {
        list: roleResourceActions.list,
        assign: roleResourceActions.assign,
        remove: roleResourceActions.remove,
      },
    });

    // Load stored roles into in-memory ACL
    await this.loadRolesFromDB();
  }

  /**
   * Read stored role and permission data from the DB and populate the in-memory ACL.
   */
  private async loadRolesFromDB(): Promise<void> {
    try {
      const rolesRepo = this.db.getRepository('roles');
      const roleResourcesRepo = this.db.getRepository('roleResources');

      if (!rolesRepo || !roleResourcesRepo) return;

      const roles = await rolesRepo.find({});

      for (const role of roles) {
        // Define the role in the in-memory ACL
        this.app.acl.defineRole(role.name, {
          strategy: role.strategy || 'denyAll',
          snippets: role.snippets || [],
        });

        // Load permissions for this role
        const resources = await roleResourcesRepo.find({
          filter: { roleId: role.id },
        });

        for (const rr of resources) {
          const aclRole = this.app.acl.getRole(role.name);
          if (aclRole && rr.actions) {
            for (const [actionName, permission] of Object.entries(rr.actions)) {
              aclRole.grant(rr.resource, actionName, permission as any);
            }
          }
        }
      }
    } catch {
      // DB might not be connected yet; ignore
    }
  }

  async install(): Promise<void> {
    const rolesRepo = this.db.getRepository('roles');

    // Seed default roles
    const defaultRoles = [
      { name: 'root', title: 'Root', strategy: 'allowAll', snippets: ['!*'] },
      { name: 'admin', title: 'Admin', strategy: 'allowAll', snippets: ['!*'] },
      { name: 'developer', title: 'Developer', strategy: 'allowAll', snippets: ['!*'] },
      { name: 'member', title: 'Member', strategy: 'denyAll', snippets: [] },
    ];

    for (const role of defaultRoles) {
      const existing = await rolesRepo.findOne({ filter: { name: role.name } });
      if (!existing) {
        await rolesRepo.create({ values: role });
        this.app.acl.defineRole(role.name, {
          strategy: role.strategy as any,
          snippets: role.snippets,
        });
      }
    }

    // Grant platform access to admin roles
    for (const roleName of ['root', 'admin', 'developer']) {
      this.app.acl.grantPlatformAccess(roleName);
    }

    // Assign root role to the default root user (id=1)
    try {
      const roleUsersRepo = this.db.getRepository('roleUsers');
      const rootRole = await rolesRepo.findOne({ filter: { name: 'root' } });
      if (rootRole) {
        const existing = await roleUsersRepo.findOne({
          filter: { roleId: rootRole.id, userId: 1 },
        });
        if (!existing) {
          await roleUsersRepo.create({ values: { roleId: rootRole.id, userId: 1 } });
        }
      }
    } catch {
      // Ignore if users table doesn't exist yet
    }
  }
}
