import { Context, Next } from 'koa';
import { AuthManager } from './auth-manager';

/**
 * Middleware that authenticates the request and sets ctx.state.currentUser / ctx.state.currentRole.
 * Does not block unauthenticated requests — use requireAuth() for that.
 */
export function authMiddleware(authManager: AuthManager) {
  return async (ctx: Context & { state: any }, next: Next) => {
    const user = await authManager.authenticate(ctx);
    ctx.state.currentUser = user;
    // Support both plain `role` string field and `roles` array association
    ctx.state.currentRole = (user as any)?.role ?? user?.roles?.[0]?.name;
    await next();
  };
}

/**
 * Middleware that requires authentication.
 * Returns 401 if no currentUser is set on ctx.state.
 */
export function requireAuth() {
  return async (ctx: Context & { state: any }, next: Next) => {
    if (!ctx.state.currentUser) {
      ctx.status = 401;
      ctx.body = { errors: [{ message: 'Authentication required', code: 'UNAUTHORIZED' }] };
      return;
    }
    await next();
  };
}
