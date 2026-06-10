import { User, AuthConfig } from '@formai/shared';

export abstract class BaseAuth {
  constructor(protected config: AuthConfig) {}

  /**
   * Authenticate an incoming request and return the authenticated user (or null).
   */
  abstract check(ctx: any): Promise<User | null>;

  /**
   * Handle a sign-in request and return tokens + user.
   */
  abstract signIn(ctx: any): Promise<{ token: string; refreshToken?: string; user: User }>;

  /**
   * Handle a sign-out request.
   * Default implementation blacklists the current token.
   */
  async signOut(_ctx: any): Promise<void> {
    // Default: subclass should override to invalidate the token
  }
}
