import type { RoleStrategy, Filter } from '@formai/shared';
import { ACLRole } from './acl-role';

export interface RoleOptions {
  strategy?: RoleStrategy;
  actions?: Record<string, ActionPermission>;
  snippets?: string[];
}

export interface ActionPermission {
  fields?: string[];
  filter?: Filter;
  own?: boolean;
  whitelist?: string[];
  blacklist?: string[];
}

export interface FixedParams {
  fields?: string[];
  filter?: Filter;
  own?: boolean;
  whitelist?: string[];
  blacklist?: string[];
}

interface AllowRule {
  resource: string;
  action: string;
  condition?: string;
}

export class ACL {
  private roles: Map<string, ACLRole> = new Map();
  private allowedConditions: Map<string, (ctx: any) => boolean> = new Map();
  private snippets: Map<string, string[]> = new Map(); // snippet → resource patterns
  private allowRules: AllowRule[] = [];

  constructor() {
    // Register built-in conditions
    this.registerCondition('loggedIn', (ctx) => !!ctx.state?.currentUser);
    this.registerCondition('public', () => true);
    this.registerCondition('allowConfigure', (ctx) => {
      const role = ctx.state?.currentRole;
      return role === 'root' || role === 'admin';
    });
    this.registerCondition('isPlatformAdmin', (ctx) => {
      const role = ctx.state?.currentRole;
      return role === 'root' || role === 'admin' || role === 'developer';
    });
  }

  // ─── Platform & App permission helpers ───────────────────────────────────────

  /**
   * Grant a role access to the platform admin area.
   * Resource pattern: 'platform', action: 'configure'
   */
  grantPlatformAccess(roleName: string): void {
    const role = this.roles.get(roleName);
    if (role) {
      role.grant('platform', 'configure');
    }
  }

  /**
   * Grant a role access to a specific app.
   * Resource pattern: 'app:{appName}', action: 'view' | 'admin'
   */
  grantAppAccess(roleName: string, appName: string, action: 'view' | 'admin' = 'view'): void {
    const role = this.roles.get(roleName);
    if (role) {
      role.grant(`app:${appName}`, action);
    }
  }

  /**
   * Grant a role access to a menu item.
   * Resource pattern: 'menu:{appName}.{menuPath}', action: 'view'
   */
  grantMenuAccess(roleName: string, appName: string, menuPath: string): void {
    const role = this.roles.get(roleName);
    if (role) {
      role.grant(`menu:${appName}.${menuPath}`, 'view');
    }
  }

  /**
   * Check if a role can access the platform admin area.
   */
  canAccessPlatform(roleName: string): boolean {
    return this.can(roleName, 'platform', 'configure') !== false;
  }

  /**
   * Check if a role can access a specific app.
   */
  canAccessApp(roleName: string, appName: string): boolean {
    // platform admins can access all apps
    if (this.canAccessPlatform(roleName)) return true;
    return this.can(roleName, `app:${appName}`, 'view') !== false;
  }

  /**
   * Check if a role can view a menu item.
   */
  canViewMenu(roleName: string, appName: string, menuPath: string): boolean {
    // platform/app admins bypass menu checks
    if (this.canAccessPlatform(roleName)) return true;
    if (this.can(roleName, `app:${appName}`, 'admin') !== false) return true;
    // no permissionKey = accessible to all app users
    if (!menuPath) return true;
    return this.can(roleName, `menu:${appName}.${menuPath}`, 'view') !== false;
  }

  // Define a role
  defineRole(name: string, options: RoleOptions): ACLRole {
    const role = new ACLRole(name, options);
    this.roles.set(name, role);
    return role;
  }

  // Get a role
  getRole(name: string): ACLRole | undefined {
    return this.roles.get(name);
  }

  // Check if a role can perform an action on a resource
  can(roleName: string, resource: string, action: string): ActionPermission | false {
    const role = this.roles.get(roleName);
    if (!role) return false;
    return role.can(resource, action);
  }

  // Allow a resource/action for everyone or with a condition
  allow(resource: string, action: string, condition?: string): void {
    this.allowRules.push({ resource, action, condition });
  }

  // Check if a resource/action is globally allowed (optionally for a given context)
  isAllowed(resource: string, action: string, ctx?: any): boolean {
    for (const rule of this.allowRules) {
      const resourceMatch = rule.resource === resource || rule.resource === '*';
      const actionMatch = rule.action === action || rule.action === '*';
      if (resourceMatch && actionMatch) {
        if (!rule.condition) return true;
        return this.checkCondition(rule.condition, ctx);
      }
    }
    return false;
  }

  // Register a custom condition
  registerCondition(name: string, handler: (ctx: any) => boolean): void {
    this.allowedConditions.set(name, handler);
  }

  // Check a condition
  checkCondition(name: string, ctx: any): boolean {
    const handler = this.allowedConditions.get(name);
    return handler ? handler(ctx) : false;
  }

  // Register a snippet (group of resources/actions)
  registerSnippet(name: string, resources: string[]): void {
    this.snippets.set(name, resources);
  }

  // Get snippet resources
  getSnippet(name: string): string[] | undefined {
    return this.snippets.get(name);
  }

  // Check if a role has a snippet permission
  hasSnippet(roleName: string, snippetName: string): boolean {
    const role = this.roles.get(roleName);
    if (!role) return false;
    return role.options.snippets?.includes(snippetName) || false;
  }

  // Get fixed params for a role/resource/action (field filtering, data scope)
  getFixedParams(roleName: string, resource: string, action: string): FixedParams | null {
    const permission = this.can(roleName, resource, action);
    if (!permission) return null;
    return permission as FixedParams;
  }
}
