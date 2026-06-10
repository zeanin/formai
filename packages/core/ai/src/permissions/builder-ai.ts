export interface BuilderAIConfig {
  allowedRoles: string[];
  requireDoubleConfirm: boolean;
  auditEnabled: boolean;
}

export interface AuditEntry {
  timestamp: Date;
  userId: string;
  operation: string;
  details: Record<string, any>;
  result: 'success' | 'failure' | 'rejected';
  _index: number; // Internal: insertion order for stable sorting
}

const DEFAULT_CONFIG: BuilderAIConfig = {
  allowedRoles: ['root', 'admin'],
  requireDoubleConfirm: true,
  auditEnabled: true,
};

export class BuilderAIPermission {
  private config: BuilderAIConfig;
  private auditLog: AuditEntry[] = []; // In production, persist to DB
  private auditIndex = 0;

  constructor(config?: Partial<BuilderAIConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Check if user can access Builder AI
  canAccess(user: { roles?: Array<{ name: string }> }): boolean {
    return user.roles?.some((r) => this.config.allowedRoles.includes(r.name)) || false;
  }

  // Check if operation requires double confirmation
  requireDoubleConfirm(_operation: string): boolean {
    return this.config.requireDoubleConfirm;
  }

  // Log an operation for audit
  audit(
    userId: string,
    operation: string,
    details: Record<string, any>,
    result: 'success' | 'failure' | 'rejected',
  ): void {
    if (!this.config.auditEnabled) return;

    this.auditLog.push({
      timestamp: new Date(),
      userId,
      operation,
      details,
      result,
      _index: this.auditIndex++,
    });
  }

  // Get audit log entries
  getAuditLog(options?: { userId?: string; operation?: string; limit?: number }): AuditEntry[] {
    let entries = [...this.auditLog];

    if (options?.userId) {
      entries = entries.filter((e) => e.userId === options.userId);
    }

    if (options?.operation) {
      entries = entries.filter((e) => e.operation === options.operation);
    }

    // Most recent first, stable by insertion order
    entries.sort((a, b) => {
      const timeDiff = b.timestamp.getTime() - a.timestamp.getTime();
      if (timeDiff !== 0) return timeDiff;
      return b._index - a._index;
    });

    if (options?.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  // Get current config
  getConfig(): BuilderAIConfig {
    return { ...this.config };
  }

  // Update config
  updateConfig(config: Partial<BuilderAIConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Clear audit log (for testing)
  clearAuditLog(): void {
    this.auditLog = [];
    this.auditIndex = 0;
  }
}
