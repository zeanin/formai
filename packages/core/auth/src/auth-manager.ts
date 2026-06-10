import { User, AuthConfig } from '@formai/shared';
import { BaseAuth } from './base-auth';

export class AuthManager {
  private authenticators: Map<string, BaseAuth> = new Map();
  private defaultType: string = 'basic';

  constructor(private config: AuthConfig) {}

  /**
   * Register an authenticator type by name.
   */
  registerType(name: string, authClass: new (config: AuthConfig) => BaseAuth): void {
    this.authenticators.set(name, new authClass(this.config));
  }

  /**
   * Set the default authenticator type (used when no X-Authenticator header is present).
   */
  setDefaultType(name: string): void {
    if (!this.authenticators.has(name)) {
      throw new Error(`Cannot set default to unregistered authenticator: ${name}`);
    }
    this.defaultType = name;
  }

  /**
   * Authenticate a request using the X-Authenticator header or the default type.
   */
  async authenticate(ctx: any): Promise<User | null> {
    const type = ctx.get('X-Authenticator') || this.defaultType;
    const auth = this.authenticators.get(type);
    if (!auth) {
      throw new Error(`Unknown authenticator type: ${type}`);
    }
    return auth.check(ctx);
  }

  /**
   * Get an authenticator instance by type name.
   */
  getAuthenticator(type: string): BaseAuth | undefined {
    return this.authenticators.get(type);
  }
}
