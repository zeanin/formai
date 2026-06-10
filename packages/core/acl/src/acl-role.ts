import type { RoleStrategy } from '@formai/shared';
import type { RoleOptions, ActionPermission } from './acl';

export class ACLRole {
  name: string;
  options: RoleOptions;
  private actions: Map<string, ActionPermission> = new Map(); // 'resource:action' → permission

  constructor(name: string, options: RoleOptions) {
    this.name = name;
    this.options = options;
    // Parse options.actions into the internal map
    if (options.actions) {
      for (const [key, perm] of Object.entries(options.actions)) {
        this.actions.set(key, perm);
      }
    }
  }

  // Grant permission: resource:action or resource:*
  grant(resource: string, action: string, permission?: ActionPermission): void {
    this.actions.set(`${resource}:${action}`, permission || {});
  }

  // Revoke permission
  revoke(resource: string, action: string): void {
    this.actions.delete(`${resource}:${action}`);
  }

  // Check if this role can perform action on resource
  can(resource: string, action: string): ActionPermission | false {
    // Check specific permission first
    const specific = this.actions.get(`${resource}:${action}`);
    if (specific !== undefined) return specific;

    // Check wildcard permission
    const wildcard = this.actions.get(`${resource}:*`);
    if (wildcard !== undefined) return wildcard;

    // Check global wildcard
    const globalWild = this.actions.get('*:*');
    if (globalWild !== undefined) return globalWild;

    // Apply strategy
    if (this.options.strategy === 'allowAll') return {};
    return false;
  }

  // Get all granted actions for a resource
  getResourceActions(resource: string): string[] {
    const actions: string[] = [];
    for (const key of this.actions.keys()) {
      if (key.startsWith(`${resource}:`)) {
        actions.push(key.split(':')[1]);
      }
    }
    return actions;
  }
}
