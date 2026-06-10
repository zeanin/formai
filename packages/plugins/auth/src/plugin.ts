import { Plugin } from '@formai/plugin';
import { AuthManager, BasicAuth, authMiddleware } from '@formai/auth';
import type { Context, Next } from 'koa';

/**
 * AuthPlugin — registers AuthManager on the Application, wires BasicAuth,
 * and exposes POST /api/auth/signIn, /signOut, /refresh REST endpoints.
 */
export default class AuthPlugin extends Plugin {
  authManager!: AuthManager;

  async load(): Promise<void> {
    const config = this.options as any;

    const jwtConfig = config.jwt ?? {
      secret: process.env.JWT_SECRET || 'formai-dev-secret',
      expiresIn: '7d',
      refreshExpiresIn: '30d',
    };

    // Create and attach AuthManager to the Application
    this.authManager = new AuthManager({ jwt: jwtConfig });
    this.authManager.registerType('basic', BasicAuth);
    this.app.authManager = this.authManager;

    // Install auth middleware: populates ctx.state.currentUser / currentRole
    this.addMiddleware(authMiddleware(this.authManager));

    // ── Auth routes ──────────────────────────────────────────────────────────

    this.app.use(async (ctx: Context & { state: any }, next: Next) => {
      // POST /api/auth/signIn
      if (ctx.path === '/api/auth/signIn' && ctx.method === 'POST') {
        try {
          const auth = this.authManager.getAuthenticator('basic') as BasicAuth;
          const result = await (auth as any).signIn(ctx);
          ctx.body = { data: result };
        } catch (err: any) {
          ctx.status = 401;
          ctx.body = { errors: [{ message: err.message, code: 'SIGN_IN_FAILED' }] };
        }
        return;
      }

      // POST /api/auth/signOut
      if (ctx.path === '/api/auth/signOut' && ctx.method === 'POST') {
        try {
          const auth = this.authManager.getAuthenticator('basic') as BasicAuth;
          await (auth as any).signOut(ctx);
          ctx.body = { data: { success: true } };
        } catch (err: any) {
          ctx.status = 400;
          ctx.body = { errors: [{ message: err.message, code: 'SIGN_OUT_FAILED' }] };
        }
        return;
      }

      // POST /api/auth/refresh
      if (ctx.path === '/api/auth/refresh' && ctx.method === 'POST') {
        try {
          const { refreshToken } = (ctx as any).request.body ?? {};
          if (!refreshToken) {
            ctx.status = 400;
            ctx.body = { errors: [{ message: 'refreshToken is required', code: 'VALIDATION_ERROR' }] };
            return;
          }
          const auth = this.authManager.getAuthenticator('basic') as any;
          const tokens = auth.tokenManager.refresh(refreshToken);
          ctx.body = { data: tokens };
        } catch (err: any) {
          ctx.status = 401;
          ctx.body = { errors: [{ message: err.message, code: 'REFRESH_FAILED' }] };
        }
        return;
      }

      // GET /api/auth/me — current user profile
      if (ctx.path === '/api/auth/me' && ctx.method === 'GET') {
        const user = (ctx as any).state?.currentUser;
        if (!user) {
          ctx.status = 401;
          ctx.body = { errors: [{ message: 'Not authenticated', code: 'UNAUTHORIZED' }] };
          return;
        }
        const repo = this.db.getRepository('users');
        const freshUser = await repo.findById(user.id);
        if (!freshUser) {
          ctx.status = 404;
          ctx.body = { errors: [{ message: 'User not found', code: 'NOT_FOUND' }] };
          return;
        }
        const { password: _, ...safeUser } = freshUser as any;
        ctx.body = { data: safeUser };
        return;
      }

      await next();
    });
  }
}
