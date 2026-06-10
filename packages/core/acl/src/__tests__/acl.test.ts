import { describe, it, expect, vi } from 'vitest';
import { ACL } from '../acl';
import { ACLRole } from '../acl-role';
import { aclMiddleware } from '../middleware';

// ─── ACL: Role definition and can() ──────────────────────────────────────────

describe('ACL - defineRole / getRole / can()', () => {
  it('defines and retrieves a role', () => {
    const acl = new ACL();
    const role = acl.defineRole('editor', {});
    expect(acl.getRole('editor')).toBe(role);
  });

  it('returns false for an unknown role', () => {
    const acl = new ACL();
    expect(acl.can('ghost', 'posts', 'list')).toBe(false);
  });

  it('returns false when role has no matching action', () => {
    const acl = new ACL();
    acl.defineRole('viewer', {});
    expect(acl.can('viewer', 'posts', 'create')).toBe(false);
  });

  it('returns permission object when role has specific action', () => {
    const acl = new ACL();
    acl.defineRole('editor', {
      actions: { 'posts:create': { fields: ['title', 'body'] } },
    });
    expect(acl.can('editor', 'posts', 'create')).toEqual({ fields: ['title', 'body'] });
  });
});

// ─── Strategy: allowAll / denyAll ────────────────────────────────────────────

describe('ACL - strategy', () => {
  it('allowAll strategy returns {} for any resource/action', () => {
    const acl = new ACL();
    acl.defineRole('superuser', { strategy: 'allowAll' });
    expect(acl.can('superuser', 'anything', 'destroy')).toEqual({});
  });

  it('denyAll (default) returns false when no action matches', () => {
    const acl = new ACL();
    acl.defineRole('restricted', {});
    expect(acl.can('restricted', 'posts', 'list')).toBe(false);
  });
});

// ─── Wildcard permissions ─────────────────────────────────────────────────────

describe('ACLRole - wildcard permissions', () => {
  it('resource:* matches any action on that resource', () => {
    const acl = new ACL();
    acl.defineRole('mod', {
      actions: { 'posts:*': { fields: ['title'] } },
    });
    expect(acl.can('mod', 'posts', 'delete')).toEqual({ fields: ['title'] });
    expect(acl.can('mod', 'posts', 'update')).toEqual({ fields: ['title'] });
  });

  it('*:* matches any resource and action', () => {
    const acl = new ACL();
    acl.defineRole('admin', {
      actions: { '*:*': {} },
    });
    expect(acl.can('admin', 'users', 'destroy')).toEqual({});
    expect(acl.can('admin', 'orders', 'list')).toEqual({});
  });

  it('specific permission takes priority over wildcard', () => {
    const acl = new ACL();
    acl.defineRole('mod', {
      actions: {
        'posts:*': { fields: ['title'] },
        'posts:create': { fields: ['title', 'body'] },
      },
    });
    // specific key wins
    expect(acl.can('mod', 'posts', 'create')).toEqual({ fields: ['title', 'body'] });
    // fallback to wildcard
    expect(acl.can('mod', 'posts', 'delete')).toEqual({ fields: ['title'] });
  });
});

// ─── ACLRole: grant / revoke ──────────────────────────────────────────────────

describe('ACLRole - grant / revoke', () => {
  it('grant adds a permission', () => {
    const acl = new ACL();
    const role = acl.defineRole('editor', {});
    role.grant('posts', 'create', { fields: ['title'] });
    expect(acl.can('editor', 'posts', 'create')).toEqual({ fields: ['title'] });
  });

  it('revoke removes a permission', () => {
    const acl = new ACL();
    const role = acl.defineRole('editor', {
      actions: { 'posts:delete': {} },
    });
    role.revoke('posts', 'delete');
    expect(acl.can('editor', 'posts', 'delete')).toBe(false);
  });

  it('getResourceActions returns all granted action names', () => {
    const acl = new ACL();
    const role = acl.defineRole('editor', {
      actions: { 'posts:list': {}, 'posts:create': {}, 'users:list': {} },
    });
    const actions = role.getResourceActions('posts');
    expect(actions).toContain('list');
    expect(actions).toContain('create');
    expect(actions).not.toContain('destroy'); // only includes posts actions, not users
    expect(actions.length).toBe(2);
  });
});

// ─── Fixed params ─────────────────────────────────────────────────────────────

describe('ACL - getFixedParams', () => {
  it('returns null for unknown role', () => {
    const acl = new ACL();
    expect(acl.getFixedParams('ghost', 'posts', 'list')).toBeNull();
  });

  it('returns null when permission is false', () => {
    const acl = new ACL();
    acl.defineRole('viewer', {});
    expect(acl.getFixedParams('viewer', 'posts', 'delete')).toBeNull();
  });

  it('returns fixed params object', () => {
    const acl = new ACL();
    acl.defineRole('user', {
      actions: {
        'posts:list': { filter: { status: 'published' }, fields: ['title'] },
      },
    });
    expect(acl.getFixedParams('user', 'posts', 'list')).toEqual({
      filter: { status: 'published' },
      fields: ['title'],
    });
  });
});

// ─── Conditions ───────────────────────────────────────────────────────────────

describe('ACL - conditions', () => {
  it('public condition always returns true', () => {
    const acl = new ACL();
    expect(acl.checkCondition('public', {})).toBe(true);
  });

  it('loggedIn condition returns true when currentUser is set', () => {
    const acl = new ACL();
    expect(acl.checkCondition('loggedIn', { state: { currentUser: { id: 1 } } })).toBe(true);
    expect(acl.checkCondition('loggedIn', { state: {} })).toBe(false);
  });

  it('allowConfigure returns true for root/admin roles', () => {
    const acl = new ACL();
    expect(acl.checkCondition('allowConfigure', { state: { currentRole: 'root' } })).toBe(true);
    expect(acl.checkCondition('allowConfigure', { state: { currentRole: 'admin' } })).toBe(true);
    expect(acl.checkCondition('allowConfigure', { state: { currentRole: 'viewer' } })).toBe(false);
  });

  it('custom condition can be registered', () => {
    const acl = new ACL();
    acl.registerCondition('isPremium', (ctx) => !!ctx.state?.user?.premium);
    expect(acl.checkCondition('isPremium', { state: { user: { premium: true } } })).toBe(true);
    expect(acl.checkCondition('isPremium', { state: { user: {} } })).toBe(false);
  });

  it('unknown condition returns false', () => {
    const acl = new ACL();
    expect(acl.checkCondition('nonexistent', {})).toBe(false);
  });
});

// ─── Snippets ─────────────────────────────────────────────────────────────────

describe('ACL - snippets', () => {
  it('registers and retrieves a snippet', () => {
    const acl = new ACL();
    acl.registerSnippet('pm.*', ['projects:*', 'tasks:*']);
    expect(acl.getSnippet('pm.*')).toEqual(['projects:*', 'tasks:*']);
  });

  it('hasSnippet returns true when role includes snippet', () => {
    const acl = new ACL();
    acl.defineRole('manager', { snippets: ['pm.*', 'hr.*'] });
    expect(acl.hasSnippet('manager', 'pm.*')).toBe(true);
    expect(acl.hasSnippet('manager', 'finance.*')).toBe(false);
  });

  it('hasSnippet returns false for unknown role', () => {
    const acl = new ACL();
    expect(acl.hasSnippet('ghost', 'pm.*')).toBe(false);
  });
});

// ─── ACL.allow() ──────────────────────────────────────────────────────────────

describe('ACL - allow()', () => {
  it('allows a resource/action globally (no condition)', () => {
    const acl = new ACL();
    acl.allow('auth', 'signIn');
    expect(acl.isAllowed('auth', 'signIn')).toBe(true);
  });

  it('allows with a condition that resolves', () => {
    const acl = new ACL();
    acl.allow('users', 'me', 'loggedIn');
    const ctx = { state: { currentUser: { id: 1 } } };
    expect(acl.isAllowed('users', 'me', ctx)).toBe(true);
  });

  it('denies when condition fails', () => {
    const acl = new ACL();
    acl.allow('users', 'me', 'loggedIn');
    const ctx = { state: {} };
    expect(acl.isAllowed('users', 'me', ctx)).toBe(false);
  });

  it('non-listed resource/action returns false', () => {
    const acl = new ACL();
    expect(acl.isAllowed('posts', 'list')).toBe(false);
  });
});

// ─── Middleware ───────────────────────────────────────────────────────────────

describe('aclMiddleware', () => {
  function makeCtx(overrides: Record<string, any> = {}): any {
    return {
      state: {},
      action: { resourceName: 'posts', actionName: 'list', params: {} },
      status: 200,
      body: null,
      ...overrides,
    };
  }

  it('skips when no action context', async () => {
    const acl = new ACL();
    const mw = aclMiddleware(acl);
    const ctx = makeCtx({ action: null });
    const next = vi.fn();
    await mw(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when role lacks permission', async () => {
    const acl = new ACL();
    acl.defineRole('viewer', {});
    const mw = aclMiddleware(acl);
    const ctx = makeCtx({ state: { currentRole: 'viewer' } });
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through when role has permission', async () => {
    const acl = new ACL();
    acl.defineRole('editor', { actions: { 'posts:list': {} } });
    const mw = aclMiddleware(acl);
    const ctx = makeCtx({ state: { currentRole: 'editor' } });
    const next = vi.fn();
    await mw(ctx, next);
    expect(next).toHaveBeenCalled();
    expect(ctx.status).toBe(200);
  });

  it('merges filter from permission into action params', async () => {
    const acl = new ACL();
    acl.defineRole('user', {
      actions: { 'posts:list': { filter: { published: true } } },
    });
    const mw = aclMiddleware(acl);
    const ctx = makeCtx({ state: { currentRole: 'user' } });
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.action.params.filter).toEqual({ published: true });
  });

  it('merges existing filter with permission filter using $and', async () => {
    const acl = new ACL();
    acl.defineRole('user', {
      actions: { 'posts:list': { filter: { published: true } } },
    });
    const mw = aclMiddleware(acl);
    const ctx = makeCtx({
      state: { currentRole: 'user' },
      action: {
        resourceName: 'posts',
        actionName: 'list',
        params: { filter: { status: 'active' } },
      },
    });
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.action.params.filter).toEqual({
      $and: [{ status: 'active' }, { published: true }],
    });
  });

  it('adds own filter when permission.own is set', async () => {
    const acl = new ACL();
    acl.defineRole('author', {
      actions: { 'posts:list': { own: true } },
    });
    const mw = aclMiddleware(acl);
    const ctx = makeCtx({
      state: { currentRole: 'author', currentUser: { id: 42 } },
    });
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.action.params.filter).toEqual({ createdById: 42 });
  });

  it('sets fields, whitelist, blacklist from permission', async () => {
    const acl = new ACL();
    acl.defineRole('limited', {
      actions: {
        'posts:create': {
          fields: ['title'],
          whitelist: ['title'],
          blacklist: ['secret'],
        },
      },
    });
    const mw = aclMiddleware(acl);
    const ctx = makeCtx({
      state: { currentRole: 'limited' },
      action: { resourceName: 'posts', actionName: 'create', params: {} },
    });
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.action.params.fields).toEqual(['title']);
    expect(ctx.action.params.whitelist).toEqual(['title']);
    expect(ctx.action.params.blacklist).toEqual(['secret']);
  });

  it('returns 401 when no roleName and public condition fails', async () => {
    const acl = new ACL();
    // Override public condition to return false
    acl.registerCondition('public', () => false);
    const mw = aclMiddleware(acl);
    const ctx = makeCtx({ state: {} });
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through with no roleName when public condition passes', async () => {
    const acl = new ACL();
    // public condition is always true by default
    const mw = aclMiddleware(acl);
    const ctx = makeCtx({ state: {} });
    const next = vi.fn();
    await mw(ctx, next);
    expect(next).toHaveBeenCalled();
  });
});
