import { BaseAuth } from './base-auth';
import { User, AuthConfig } from '@formai/shared';
import { TokenManager } from './token-manager';
import { comparePassword } from './password';

export class BasicAuth extends BaseAuth {
  private tokenManager: TokenManager;

  constructor(config: AuthConfig) {
    super(config);
    this.tokenManager = new TokenManager(config.jwt);
  }

  async check(ctx: any): Promise<User | null> {
    const token = this.extractToken(ctx);
    if (!token) return null;

    try {
      const payload = this.tokenManager.verify(token);
      // Look up user from database using ctx.db
      const user = await ctx.db.getRepository('users').findById(payload.userId);
      return user;
    } catch {
      return null;
    }
  }

  async signIn(ctx: any): Promise<{ token: string; refreshToken: string; user: User }> {
    const { username, email, password } = ctx.request.body;

    // Find user by username or email
    const repository = ctx.db.getRepository('users');
    const user: User | null = username
      ? await repository.findOne({ filter: { username } })
      : await repository.findOne({ filter: { email } });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const passwordHash = user.password as string;
    const valid = await comparePassword(password, passwordHash);
    if (!valid) {
      throw new Error('Invalid password');
    }

    // Generate tokens
    const roleName = (user as any).role ?? user.roles?.[0]?.name;
    const token = this.tokenManager.sign({ userId: user.id, roleName });
    const refreshToken = this.tokenManager.signRefresh({ userId: user.id, roleName });

    return { token, refreshToken, user };
  }

  async signOut(ctx: any): Promise<void> {
    const token = this.extractToken(ctx);
    if (token) {
      await this.tokenManager.blacklist(token);
    }
  }

  private extractToken(ctx: any): string | null {
    const auth = ctx.get('Authorization');
    if (auth?.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    return null;
  }
}
