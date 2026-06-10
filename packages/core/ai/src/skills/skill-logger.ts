import type { SkillContext } from '@formai/shared';

export interface SkillLogEntry {
  skillName: string;
  skillTitle?: string;
  userId?: number | string;
  userRoles?: string[];
  appId?: number | string | null;
  inputArgs: Record<string, any>;
  output?: any;
  status: 'success' | 'error' | 'pending_confirm' | 'confirmed' | 'cancelled';
  errorMessage?: string;
  durationMs?: number;
  sessionId?: string;
  confirmationId?: string;
}

/**
 * SkillLogger — Lightweight AI Skill execution log service
 *
 * Writes every Skill invocation record to the `skill_execution_logs` table.
 * Failures do not affect the main process flow (fire-and-forget).
 */
export class SkillLogger {
  constructor(private db: any) {}

  /**
   * Write a log entry (non-blocking, silent on failure)
   */
  async log(entry: SkillLogEntry): Promise<void> {
    try {
      const repo = this.db.getRepository('skill_execution_logs');
      if (!repo) return;

      await repo.create({
        values: {
          skillName:      entry.skillName,
          skillTitle:     entry.skillTitle,
          userId:         entry.userId,
          userRoles:      entry.userRoles ?? [],
          appId:          entry.appId,
          inputArgs:      entry.inputArgs,
          output:         entry.output ?? null,
          status:         entry.status,
          errorMessage:   entry.errorMessage,
          durationMs:     entry.durationMs,
          sessionId:      entry.sessionId,
          confirmationId: entry.confirmationId,
        },
      });
    } catch {
      // Log write failure does not interrupt the main flow
    }
  }

  /**
   * Query recent logs of a specific Skill or App
   */
  async recent(options: {
    skillName?: string;
    appId?: number | string;
    userId?: number | string;
    sessionId?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      const repo = this.db.getRepository('skill_execution_logs');
      if (!repo) return [];

      const filter: Record<string, any> = {};
      if (options.skillName) filter.skillName = options.skillName;
      if (options.appId)     filter.appId = options.appId;
      if (options.userId)    filter.userId = isNaN(Number(options.userId)) ? options.userId : Number(options.userId);
      if (options.sessionId) filter.sessionId = options.sessionId;

      return await repo.find({
        filter,
        sort: ['-createdAt'],
        page: 1,
        pageSize: options.limit ?? 50,
      });
    } catch {
      return [];
    }
  }
}

/**
 * Wrap SkillExecutor to automatically log before and after execution
 */
export function withLogging(
  logger: SkillLogger,
  skillName: string,
  skillTitle: string,
  executor: (args: any, context: SkillContext) => Promise<any>,
): (args: any, context: SkillContext) => Promise<any> {
  return async (args: any, context: SkillContext): Promise<any> => {
    const start = Date.now();
    try {
      const result = await executor(args, context);
      const durationMs = Date.now() - start;

      // Fire-and-forget log
      logger.log({
        skillName,
        skillTitle,
        userId:    context.userId,
        userRoles: context.roles,
        appId:     context.appId,
        inputArgs: args,
        output:    result,
        status:    'success',
        durationMs,
        sessionId: (context as any).sessionId,
      }).catch(() => {});

      return result;
    } catch (err: any) {
      const durationMs = Date.now() - start;

      logger.log({
        skillName,
        skillTitle,
        userId:       context.userId,
        userRoles:    context.roles,
        appId:        context.appId,
        inputArgs:    args,
        status:       'error',
        errorMessage: err.message,
        durationMs,
        sessionId:    (context as any).sessionId,
      }).catch(() => {});

      throw err;
    }
  };
}

