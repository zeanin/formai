import type { AIDataScope, ToolPermissionLevel } from '@formai/shared';

export interface AIPermissionConfig {
  // Per-role AI permissions
  roles: Record<string, RoleAIPermission>;
  // Global tool permission levels
  toolPermissions: Record<string, ToolPermissionConfig>;
  // Builder AI config
  builderAI: {
    allowedRoles: string[];
    requireDoubleConfirm: boolean;
  };
}

export interface RoleAIPermission {
  // Data access restrictions for AI
  dataScope: {
    readableCollections: string[];
    excludedCollections?: string[];
    fieldBlacklist?: Record<string, string[]>; // collection → excluded fields
    maxRowsPerQuery: number;
    allowAggregation: boolean;
    allowRawSQL: boolean;
  };
  // Schema mutation permissions
  canTriggerA2Data: boolean;
  canTriggerA2UI: boolean;
  canTriggerA2Flow: boolean;
  // Whether AI operations require approval
  requireApproval: {
    a2data: boolean;
    a2ui: boolean;
    a2flow: boolean;
  };
  // Max auto-apply operations per day
  maxAutoApplyPerDay: number;
}

export interface ToolPermissionConfig {
  level: ToolPermissionLevel;
  requireApproval?: boolean;
  maxRows?: number;
}

export class AIPermissionManager {
  private config: AIPermissionConfig;
  private dailyUsage: Map<string, number> = new Map(); // userId:date → count

  constructor(config?: Partial<AIPermissionConfig>) {
    this.config = this.buildDefaultConfig(config);
  }

  // Get AI data scope for a user based on their role
  getAIDataScope(user: { id: string; roles?: Array<{ name: string }> }, collection: string): AIDataScope {
    const rolePerm = this.getUserRolePermission(user);

    const scope = rolePerm.dataScope;

    // Check if collection is excluded
    if (scope.excludedCollections?.includes(collection)) {
      return {
        readableCollections: [],
        readableFields: {},
        maxRowsPerQuery: 0,
        allowAggregation: false,
        allowRawSQL: false,
      };
    }

    // Check if collection is readable
    const isReadable =
      scope.readableCollections.includes('*') || scope.readableCollections.includes(collection);

    if (!isReadable) {
      return {
        readableCollections: [],
        readableFields: {},
        maxRowsPerQuery: 0,
        allowAggregation: false,
        allowRawSQL: false,
      };
    }

    // Build readable fields, applying field blacklist
    let readableFields: Record<string, string[]> = {};
    if (scope.fieldBlacklist && scope.fieldBlacklist[collection]) {
      // If there's a blacklist for this collection, we indicate restricted fields
      // by storing the blacklist info; the consumer should use this to filter.
      // Since AIDataScope.readableFields is collection → allowed fields,
      // we cannot express blacklists directly. We set it to an empty array
      // meaning "all fields except blacklisted ones" — the middleware will handle it.
      readableFields[collection] = [];
    }

    return {
      readableCollections: scope.readableCollections,
      readableFields: readableFields,
      maxRowsPerQuery: scope.maxRowsPerQuery,
      allowAggregation: scope.allowAggregation,
      allowRawSQL: scope.allowRawSQL,
    };
  }

  // Get field blacklist for a user and collection
  getFieldBlacklist(user: { roles?: Array<{ name: string }> }, collection: string): string[] {
    const rolePerm = this.getUserRolePermission(user);
    return rolePerm.dataScope.fieldBlacklist?.[collection] ?? [];
  }

  // Check if user can trigger A2Data
  canTriggerA2Data(user: { roles?: Array<{ name: string }> }): boolean {
    return this.getUserRolePermission(user).canTriggerA2Data;
  }

  // Check if user can trigger A2UI
  canTriggerA2UI(user: { roles?: Array<{ name: string }> }): boolean {
    return this.getUserRolePermission(user).canTriggerA2UI;
  }

  // Check if user can trigger A2Flow
  canTriggerA2Flow(user: { roles?: Array<{ name: string }> }): boolean {
    return this.getUserRolePermission(user).canTriggerA2Flow;
  }

  // Check tool permission for a user
  canUseTool(user: { roles?: Array<{ name: string }> }, toolName: string): boolean {
    const toolConfig = this.config.toolPermissions[toolName];
    if (!toolConfig) {
      // If no config for the tool, default to 'read' level access
      return true;
    }
    if (toolConfig.level === 'forbidden') {
      return false;
    }

    // 'dangerous' tools require at least admin role
    if (toolConfig.level === 'dangerous') {
      const rolePerm = this.getUserRolePermission(user);
      return rolePerm.canTriggerA2Data; // admin+ can use dangerous tools
    }

    return true;
  }

  // Get tool permission level
  getToolPermissionLevel(toolName: string): ToolPermissionLevel {
    return this.config.toolPermissions[toolName]?.level ?? 'read';
  }

  // Check if user can access Builder AI
  canUseBuilderAI(user: { roles?: Array<{ name: string }> }): boolean {
    return (
      user.roles?.some((r) => this.config.builderAI.allowedRoles.includes(r.name)) || false
    );
  }

  // Check if operation requires approval
  requiresApproval(
    user: { roles?: Array<{ name: string }> },
    operation: 'a2data' | 'a2ui' | 'a2flow',
  ): boolean {
    return this.getUserRolePermission(user).requireApproval[operation];
  }

  // Track and check daily usage
  checkDailyLimit(userId: string): boolean {
    const key = this.getDailyKey(userId);
    const currentCount = this.dailyUsage.get(key) ?? 0;
    // We need a role to know the limit; use a default if we can't determine
    const maxPerDay = this.getDailyLimitForUser(userId);
    return currentCount < maxPerDay;
  }

  incrementUsage(userId: string): void {
    const key = this.getDailyKey(userId);
    const currentCount = this.dailyUsage.get(key) ?? 0;
    this.dailyUsage.set(key, currentCount + 1);
  }

  // Update config
  updateConfig(config: Partial<AIPermissionConfig>): void {
    this.config = this.buildDefaultConfig(config);
  }

  // Get the current config (for inspection/testing)
  getConfig(): AIPermissionConfig {
    return this.config;
  }

  // Reset daily usage (useful for testing)
  resetDailyUsage(): void {
    this.dailyUsage.clear();
  }

  private buildDefaultConfig(override?: Partial<AIPermissionConfig>): AIPermissionConfig {
    const defaults: AIPermissionConfig = {
      roles: {
        root: {
          dataScope: {
            readableCollections: ['*'],
            maxRowsPerQuery: 10000,
            allowAggregation: true,
            allowRawSQL: true,
          },
          canTriggerA2Data: true,
          canTriggerA2UI: true,
          canTriggerA2Flow: true,
          requireApproval: {
            a2data: false,
            a2ui: false,
            a2flow: false,
          },
          maxAutoApplyPerDay: 1000,
        },
        admin: {
          dataScope: {
            readableCollections: ['*'],
            maxRowsPerQuery: 5000,
            allowAggregation: true,
            allowRawSQL: false,
          },
          canTriggerA2Data: true,
          canTriggerA2UI: true,
          canTriggerA2Flow: true,
          requireApproval: {
            a2data: true,
            a2ui: false,
            a2flow: true,
          },
          maxAutoApplyPerDay: 500,
        },
        member: {
          dataScope: {
            readableCollections: ['*'],
            excludedCollections: ['users', 'systemSettings'],
            fieldBlacklist: {
              users: ['password', 'token', 'secret'],
            },
            maxRowsPerQuery: 500,
            allowAggregation: false,
            allowRawSQL: false,
          },
          canTriggerA2Data: false,
          canTriggerA2UI: false,
          canTriggerA2Flow: false,
          requireApproval: {
            a2data: true,
            a2ui: true,
            a2flow: true,
          },
          maxAutoApplyPerDay: 50,
        },
      },
      toolPermissions: {
        'ai:query': { level: 'read' },
        'ai:mutation': { level: 'write', requireApproval: true },
        'ai:schema-change': { level: 'dangerous', requireApproval: true },
        'ai:drop-table': { level: 'forbidden' },
      },
      builderAI: {
        allowedRoles: ['root', 'admin'],
        requireDoubleConfirm: true,
      },
    };

    if (!override) return defaults;

    return {
      roles: { ...defaults.roles, ...override.roles },
      toolPermissions: { ...defaults.toolPermissions, ...override.toolPermissions },
      builderAI: override.builderAI ?? defaults.builderAI,
    };
  }

  private getUserRolePermission(user: { roles?: Array<{ name: string }> }): RoleAIPermission {
    if (!user.roles || user.roles.length === 0) {
      // No roles → use most restrictive (member)
      return this.config.roles['member'] ?? this.getMinimalPermission();
    }

    // Find most permissive role permission
    // Permission hierarchy: root > admin > member
    const rolePriority = ['root', 'admin', 'member'];
    for (const roleName of rolePriority) {
      const hasRole = user.roles.some((r) => r.name === roleName);
      if (hasRole && this.config.roles[roleName]) {
        return this.config.roles[roleName];
      }
    }

    // If user has a custom role, return member-level permissions
    return this.config.roles['member'] ?? this.getMinimalPermission();
  }

  private getDailyKey(userId: string): string {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `${userId}:${today}`;
  }

  private getDailyLimitForUser(userId: string): number {
    // Default to member limit; in production, look up the user's role
    // For now, use the max across the user's roles
    // Since we don't have the user's roles here, use a reasonable default
    return this.config.roles['member']?.maxAutoApplyPerDay ?? 50;
  }

  private getMinimalPermission(): RoleAIPermission {
    return {
      dataScope: {
        readableCollections: [],
        maxRowsPerQuery: 0,
        allowAggregation: false,
        allowRawSQL: false,
      },
      canTriggerA2Data: false,
      canTriggerA2UI: false,
      canTriggerA2Flow: false,
      requireApproval: {
        a2data: true,
        a2ui: true,
        a2flow: true,
      },
      maxAutoApplyPerDay: 0,
    };
  }
}
