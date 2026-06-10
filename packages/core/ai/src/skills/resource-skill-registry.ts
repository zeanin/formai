import type {
  ResourceSkill,
  SkillContext,
  ToolDefinition,
  SkillConfirmationRequest,
} from '@formai/shared';
import { randomUUID } from 'crypto';

/** Runtime entry for registered skills (including executable handler) */
interface SkillEntry {
  skill: ResourceSkill;
  /**
   * Actual execution function (runtime injected, not persisted to DB).
   * Accepts arguments passed from AI, and returns operation results.
   */
  executor: SkillExecutor;
}

export type SkillExecutor = (args: Record<string, any>, context: SkillContext) => Promise<any>;

export type PreExecuteHook = (
  skill: ResourceSkill,
  args: Record<string, any>,
  context: SkillContext,
) => Promise<{ requiresConfirm: boolean; reason?: string } | void>;

/** Pending skill execution (temporarily stored when requiresConfirm = true) */
interface PendingConfirmation {
  confirmationId: string;
  skillName: string;
  args: Record<string, any>;
  context: SkillContext;
  expiresAt: number;
}

const CONFIRMATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * ResourceSkillRegistry — Runtime Skill Registry
 *
 * Responsibilities:
 * 1. Register/unregister skills (from DB metadata + code-injected executors)
 * 2. Filter available skills based on SkillContext (App + Role + Resource scope)
 * 3. Convert skills to ToolDefinition (for AgentRuntime / LLM Function Calling)
 * 4. Execute skills (including confirmation flow)
 */
export class ResourceSkillRegistry {
  /** name -> SkillEntry */
  private skills: Map<string, SkillEntry> = new Map();

  /** Queue of executions awaiting confirmation */
  private pendingConfirmations: Map<string, PendingConfirmation> = new Map();

  private preExecuteHooks: PreExecuteHook[] = [];

  addPreExecuteHook(hook: PreExecuteHook): void {
    this.preExecuteHooks.push(hook);
  }

  // ─── Registration ────────────────────────────────────────────────────────

  /**
   * Register a single skill.
   * @param skill    Skill metadata (from DB or code definition)
   * @param executor Actual execution function (runtime injected)
   */
  register(skill: ResourceSkill, executor: SkillExecutor): void {
    this.skills.set(skill.name, { skill, executor });
  }

  /**
   * Unregister skill (called when a Collection is deleted)
   */
  unregister(skillName: string): void {
    this.skills.delete(skillName);
  }

  /**
   * Unregister all skills of a specific resource in batch
   */
  unregisterByResource(resourceType: string, resourceName: string): void {
    for (const [name, entry] of this.skills) {
      if (
        entry.skill.resourceType === resourceType &&
        entry.skill.resourceName === resourceName
      ) {
        this.skills.delete(name);
      }
    }
  }

  has(skillName: string): boolean {
    return this.skills.has(skillName);
  }

  // ─── Query ───────────────────────────────────────────────────────────────

  /**
   * Get skills available to the current user/App based on SkillContext,
   * converting them to ToolDefinition[] for LLM Function Calling.
   */
  getAvailableTools(context: SkillContext): ToolDefinition[] {
    return this.filterSkills(context).map((entry) => this.toToolDefinition(entry.skill));
  }

  /**
   * Filter the list of available SkillEntry based on SkillContext
   */
  private filterSkills(context: SkillContext): SkillEntry[] {
    const { appId, roles = [], resourceScope } = context;

    return Array.from(this.skills.values()).filter((entry) => {
      const { skill } = entry;

      // 1. Must be enabled
      if (!skill.enabled) return false;

      // 2. App scope filtering: skill belongs to current App or is global (null/undefined)
      if (skill.appId && skill.appId !== appId) return false;

      // 3. Role permission filtering
      if (skill.rolesAllowed.length > 0) {
        const hasRole = roles.some((r) => skill.rolesAllowed.includes(r));
        if (!hasRole) return false;
      }

      // 4. Resource scope filtering (optional, used for performance optimization)
      if (resourceScope && resourceScope.length > 0) {
        const inScope = resourceScope.some(
          (s) => s.type === skill.resourceType && s.name === skill.resourceName,
        );
        if (!inScope) return false;
      }

      return true;
    });
  }

  /**
   * Convert ResourceSkill to LLM Function Calling format ToolDefinition
   */
  private toToolDefinition(skill: ResourceSkill): ToolDefinition {
    return {
      name: skill.name,
      description: skill.description,
      parameters: skill.inputSchema,
    };
  }

  // ─── Execution ───────────────────────────────────────────────────────────

  /**
   * Execute skill.
   * - If requiresConfirm = true, do not execute directly, return ConfirmationRequest
   * - Otherwise execute directly and return the result
   */
  async execute(
    skillName: string,
    args: Record<string, any>,
    context: SkillContext,
  ): Promise<{ type: 'result'; result: any } | { type: 'confirmation'; request: SkillConfirmationRequest }> {
    const entry = this.skills.get(skillName);
    if (!entry) {
      throw new Error(`Skill "${skillName}" not found in registry`);
    }

    const { skill, executor } = entry;

    // Re-verify permission (prevents direct calls bypassing getAvailableTools filtering)
    if (skill.rolesAllowed.length > 0 && context.roles) {
      const hasRole = context.roles.some((r) => skill.rolesAllowed.includes(r));
      if (!hasRole) {
        throw new Error(`Permission denied: skill "${skillName}" requires one of roles: ${skill.rolesAllowed.join(', ')}`);
      }
    }

    // 1. Run dynamic pre-execution hooks
    for (const hook of this.preExecuteHooks) {
      const hookResult = await hook(skill, args, context);
      if (hookResult?.requiresConfirm) {
        const confirmationId = randomUUID();
        const expiresAt = Date.now() + CONFIRMATION_TTL_MS;

        this.pendingConfirmations.set(confirmationId, {
          confirmationId,
          skillName,
          args,
          context,
          expiresAt,
        });

        const request: SkillConfirmationRequest = {
          confirmationId,
          skillName: skill.name,
          skillTitle: skill.title,
          humanReadableAction: hookResult.reason || this.buildHumanReadableDescription(skill, args),
          args,
          expiresAt,
        };

        return { type: 'confirmation', request };
      }
    }

    // 2. Static confirmation required -> create pending confirmation, return to frontend
    if (skill.requiresConfirm) {
      const confirmationId = randomUUID();
      const expiresAt = Date.now() + CONFIRMATION_TTL_MS;

      this.pendingConfirmations.set(confirmationId, {
        confirmationId,
        skillName,
        args,
        context,
        expiresAt,
      });

      const request: SkillConfirmationRequest = {
        confirmationId,
        skillName: skill.name,
        skillTitle: skill.title,
        humanReadableAction: this.buildHumanReadableDescription(skill, args),
        args,
        expiresAt,
      };

      return { type: 'confirmation', request };
    }

    // Execute directly
    const result = await executor(args, context);
    return { type: 'result', result };
  }

  /**
   * Confirm and execute the skill awaiting confirmation
   */
  async confirmAndExecute(
    confirmationId: string,
  ): Promise<any> {
    const pending = this.pendingConfirmations.get(confirmationId);
    if (!pending) {
      throw new Error(`Confirmation "${confirmationId}" not found or already used`);
    }

    if (Date.now() > pending.expiresAt) {
      this.pendingConfirmations.delete(confirmationId);
      throw new Error(`Confirmation "${confirmationId}" has expired`);
    }

    this.pendingConfirmations.delete(confirmationId);

    const entry = this.skills.get(pending.skillName);
    if (!entry) {
      throw new Error(`Skill "${pending.skillName}" no longer exists`);
    }

    return entry.executor(pending.args, pending.context);
  }

  // ─── Utility Methods ─────────────────────────────────────────────────────

  private buildHumanReadableDescription(skill: ResourceSkill, args: Record<string, any>): string {
    const argsStr = Object.entries(args)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ');
    return `${skill.title} (${argsStr})`;
  }

  /** List all registered skills (for debugging) */
  list(): Array<{ name: string; resourceType: string; resourceName: string; enabled: boolean }> {
    return Array.from(this.skills.values()).map(({ skill }) => ({
      name: skill.name,
      resourceType: skill.resourceType,
      resourceName: skill.resourceName,
      enabled: skill.enabled,
    }));
  }
}

