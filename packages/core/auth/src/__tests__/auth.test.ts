import { describe, it, expect, beforeEach } from 'vitest';
import { TokenManager } from '../token-manager';
import { hashPassword, comparePassword } from '../password';
import { authMiddleware, requireAuth } from '../middleware';
import { AuthManager } from '../auth-manager';
import { BasicAuth } from '../basic-auth';
import type { AuthConfig } from '@formai/shared';

// ---------------------------------------------------------------------------
// TokenManager
// ---------------------------------------------------------------------------
describe('TokenManager', () => {
  const config = { secret: 'test-secret', expiresIn: '1h', refreshExpiresIn: '7d' };
  let tm: TokenManager;

  beforeEach(() => {
    tm = new TokenManager(config);
  });

  it('signs and verifies an access token', () => {
    const token = tm.sign({ userId: '1', roleName: 'admin' });
    const payload = tm.verify(token);
    expect(payload.userId).toBe('1');
    expect(payload.roleName).toBe('admin');
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it('signs and verifies a refresh token', () => {
    const token = tm.signRefresh({ userId: '2', roleName: 'user' });
    const payload = tm.verify(token);
    expect(payload.userId).toBe('2');
  });

  it('rejects an invalid token', () => {
    expect(() => tm.verify('garbage')).toThrow();
  });

  it('blacklists a token', async () => {
    const token = tm.sign({ userId: '3' });
    await tm.blacklist(token);
    expect(tm.isBlacklisted(token)).toBe(true);
    expect(() => tm.verify(token)).toThrow('Token has been revoked');
  });

  it('refreshes tokens and blacklists the old refresh token', () => {
    const refreshToken = tm.signRefresh({ userId: '4', roleName: 'editor' });
    const result = tm.refresh(refreshToken);

    // Old refresh token should be blacklisted
    expect(tm.isBlacklisted(refreshToken)).toBe(true);

    // New tokens should be valid
    const newPayload = tm.verify(result.token);
    expect(newPayload.userId).toBe('4');

    const newRefreshPayload = tm.verify(result.refreshToken);
    expect(newRefreshPayload.userId).toBe('4');
  });

  it('throws when refreshing with a blacklisted token', async () => {
    const refreshToken = tm.signRefresh({ userId: '5' });
    await tm.blacklist(refreshToken);
    expect(() => tm.refresh(refreshToken)).toThrow('Token has been revoked');
  });
});

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------
describe('Password utilities', () => {
  it('hashes a password and compares it correctly', async () => {
    const password = 'my-secret-123';
    const hashed = await hashPassword(password);
    expect(hashed).not.toBe(password);
    expect(await comparePassword(password, hashed)).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const hashed = await hashPassword('correct-password');
    expect(await comparePassword('wrong-password', hashed)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
describe('authMiddleware', () => {
  const authConfig: AuthConfig = {
    jwt: { secret: 'test-secret', expiresIn: '1h' },
  };

  function createAuthManager() {
    const manager = new AuthManager(authConfig);
    manager.registerType('basic', BasicAuth);
    return manager;
  }

  it('sets currentUser and currentRole on ctx.state', async () => {
    const manager = createAuthManager();
    const tm = new TokenManager(authConfig.jwt);
    const token = tm.sign({ userId: '1', roleName: 'admin' });

    // Mock user repository
    const mockUser = {
      id: '1',
      username: 'testuser',
      roles: [{ name: 'admin' }],
    };

    const ctx: any = {
      get: (header: string) => (header === 'Authorization' ? `Bearer ${token}` : ''),
      state: {},
      db: {
        getRepository: () => ({
          findById: async () => mockUser,
        }),
      },
    };

    const nextCalled = { value: false };
    const next = async () => {
      nextCalled.value = true;
    };

    const middleware = authMiddleware(manager);
    await middleware(ctx, next);

    expect(ctx.state.currentUser).toEqual(mockUser);
    expect(ctx.state.currentRole).toBe('admin');
    expect(nextCalled.value).toBe(true);
  });

  it('sets currentUser to null when no token is present', async () => {
    const manager = createAuthManager();
    const ctx: any = {
      get: () => undefined,
      state: {},
      db: {
        getRepository: () => ({
          findById: async () => null,
        }),
      },
    };

    const next = async () => {};
    const middleware = authMiddleware(manager);
    await middleware(ctx, next);

    expect(ctx.state.currentUser).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// requireAuth middleware
// ---------------------------------------------------------------------------
describe('requireAuth', () => {
  it('returns 401 when no currentUser is set', async () => {
    const ctx: any = { state: {}, status: 0, body: null };
    const next = async () => {};

    const middleware = requireAuth();
    await middleware(ctx, next);

    expect(ctx.status).toBe(401);
    expect(ctx.body).toEqual({
      errors: [{ message: 'Authentication required', code: 'UNAUTHORIZED' }],
    });
  });

  it('calls next when currentUser is set', async () => {
    const ctx: any = {
      state: { currentUser: { id: '1', username: 'test' } },
      status: 0,
    };
    const nextCalled = { value: false };
    const next = async () => {
      nextCalled.value = true;
    };

    const middleware = requireAuth();
    await middleware(ctx, next);

    expect(nextCalled.value).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AuthManager
// ---------------------------------------------------------------------------
describe('AuthManager', () => {
  const authConfig: AuthConfig = {
    jwt: { secret: 'test-secret', expiresIn: '1h' },
  };

  it('registers and retrieves an authenticator', () => {
    const manager = new AuthManager(authConfig);
    manager.registerType('basic', BasicAuth);
    expect(manager.getAuthenticator('basic')).toBeInstanceOf(BasicAuth);
  });

  it('throws for unknown authenticator type', async () => {
    const manager = new AuthManager(authConfig);
    const ctx: any = { get: () => 'unknown' };
    await expect(manager.authenticate(ctx)).rejects.toThrow('Unknown authenticator type: unknown');
  });

  it('setDefaultType throws for unregistered type', () => {
    const manager = new AuthManager(authConfig);
    expect(() => manager.setDefaultType('nonexistent')).toThrow(
      'Cannot set default to unregistered authenticator: nonexistent',
    );
  });

  it('uses X-Authenticator header to select authenticator', async () => {
    const manager = new AuthManager(authConfig);
    manager.registerType('basic', BasicAuth);

    const tm = new TokenManager(authConfig.jwt);
    const token = tm.sign({ userId: '1' });

    const mockUser = { id: '1', username: 'testuser', roles: [] };
    const ctx: any = {
      get: (header: string) => {
        if (header === 'X-Authenticator') return 'basic';
        if (header === 'Authorization') return `Bearer ${token}`;
        return '';
      },
      db: {
        getRepository: () => ({
          findById: async () => mockUser,
        }),
      },
    };

    const user = await manager.authenticate(ctx);
    expect(user).toEqual(mockUser);
  });
});
