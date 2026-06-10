import type { Context, Next } from 'koa';
import { AIPermissionManager } from './ai-permission-manager';

export function aiPermissionMiddleware(permissionManager: AIPermissionManager) {
  return async (ctx: Context & { state: any; action: any }, next: Next) => {
    // Only apply to AI-related routes
    if (!ctx.path.startsWith('/api/ai/')) {
      await next();
      return;
    }

    const user = ctx.state.currentUser;
    if (!user) {
      ctx.status = 401;
      ctx.body = {
        errors: [
          { message: 'Authentication required for AI operations', code: 'UNAUTHORIZED' },
        ],
      };
      return;
    }

    // Check daily limit
    if (!permissionManager.checkDailyLimit(user.id)) {
      ctx.status = 429;
      ctx.body = {
        errors: [
          { message: 'Daily AI operation limit reached', code: 'RATE_LIMITED' },
        ],
      };
      return;
    }

    // Apply data scope restrictions for queries
    if (ctx.action?.params?.collection) {
      const scope = permissionManager.getAIDataScope(user, ctx.action.params.collection);

      // If no readable collections, deny access
      if (scope.readableCollections.length === 0) {
        ctx.status = 403;
        ctx.body = {
          errors: [
            { message: 'Access denied to this collection', code: 'FORBIDDEN' },
          ],
        };
        return;
      }

      // Restrict fields via blacklist
      const blacklist = permissionManager.getFieldBlacklist(user, ctx.action.params.collection);
      if (blacklist.length > 0) {
        if (ctx.action.params.fields && Array.isArray(ctx.action.params.fields)) {
          // Filter out blacklisted fields from the requested fields
          ctx.action.params.fields = ctx.action.params.fields.filter(
            (f: string) => !blacklist.includes(f),
          );
        }
        // Also set blacklist on params so the data layer can enforce it
        if (!ctx.action.params.blacklist) {
          ctx.action.params.blacklist = {};
        }
        ctx.action.params.blacklist[ctx.action.params.collection] = blacklist;
      }

      // Restrict page size
      if (
        ctx.action.params.pageSize &&
        ctx.action.params.pageSize > scope.maxRowsPerQuery
      ) {
        ctx.action.params.pageSize = scope.maxRowsPerQuery;
      }
    }

    await next();
    permissionManager.incrementUsage(user.id);
  };
}
