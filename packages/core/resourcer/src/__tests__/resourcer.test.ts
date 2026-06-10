import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Resourcer } from '../resourcer';
import { Resource } from '../resource';
import { list, get, create, update, destroy } from '../default-actions';

// ─── Resource class ──────────────────────────────────────────────────────────

describe('Resource', () => {
  it('stores name from options', () => {
    const r = new Resource({ name: 'posts' });
    expect(r.name).toBe('posts');
  });

  it('registers action handlers from options', () => {
    const handler = vi.fn();
    const r = new Resource({ name: 'posts', actions: { customAction: handler } });
    expect(r.getAction('customAction')).toBe(handler);
  });

  it('registers ActionOptions with handler property', () => {
    const handler = vi.fn();
    const r = new Resource({
      name: 'posts',
      actions: { customAction: { handler, middlewares: [] } },
    });
    expect(r.getAction('customAction')).toBe(handler);
  });

  it('setAction overrides an action', () => {
    const r = new Resource({ name: 'posts' });
    const h1 = vi.fn();
    const h2 = vi.fn();
    r.setAction('foo', h1);
    r.setAction('foo', h2);
    expect(r.getAction('foo')).toBe(h2);
  });

  it('returns undefined for unknown action', () => {
    const r = new Resource({ name: 'posts' });
    expect(r.getAction('nonexistent')).toBeUndefined();
  });

  it('stores middlewares', () => {
    const mw = vi.fn();
    const r = new Resource({ name: 'posts', middlewares: [mw] });
    expect(r.getMiddlewares()).toContain(mw);
  });

  it('returns empty middlewares array by default', () => {
    const r = new Resource({ name: 'posts' });
    expect(r.getMiddlewares()).toEqual([]);
  });
});

// ─── Resourcer ───────────────────────────────────────────────────────────────

describe('Resourcer', () => {
  let resourcer: Resourcer;

  beforeEach(() => {
    resourcer = new Resourcer();
  });

  it('define() creates and registers a resource', () => {
    const resource = resourcer.define({ name: 'posts' });
    expect(resource).toBeInstanceOf(Resource);
    expect(resourcer.isDefined('posts')).toBe(true);
  });

  it('getResource() returns the defined resource', () => {
    resourcer.define({ name: 'users' });
    expect(resourcer.getResource('users')).toBeInstanceOf(Resource);
  });

  it('getResource() returns undefined for unknown resource', () => {
    expect(resourcer.getResource('unknown')).toBeUndefined();
  });

  it('isDefined() returns false before definition', () => {
    expect(resourcer.isDefined('nope')).toBe(false);
  });

  it('injects default CRUD actions', () => {
    const resource = resourcer.define({ name: 'articles' });
    for (const action of ['list', 'get', 'create', 'update', 'destroy']) {
      expect(resource.getAction(action)).toBeDefined();
    }
  });

  it('respects only option — excludes actions not in only', () => {
    const resource = resourcer.define({ name: 'readonly', only: ['list', 'get'] });
    expect(resource.getAction('list')).toBeDefined();
    expect(resource.getAction('get')).toBeDefined();
    expect(resource.getAction('create')).toBeUndefined();
    expect(resource.getAction('update')).toBeUndefined();
    expect(resource.getAction('destroy')).toBeUndefined();
  });

  it('respects except option — excludes listed actions', () => {
    const resource = resourcer.define({ name: 'noDelete', except: ['destroy'] });
    expect(resource.getAction('list')).toBeDefined();
    expect(resource.getAction('destroy')).toBeUndefined();
  });

  it('custom action in options is NOT overridden by default', () => {
    const customList = vi.fn();
    const resource = resourcer.define({ name: 'custom', actions: { list: customList } });
    expect(resource.getAction('list')).toBe(customList);
  });

  it('getRouter() returns a Router with routes', () => {
    resourcer.define({ name: 'posts' });
    const router = resourcer.getRouter();
    expect(router).toBeDefined();
    // Check that routes were registered by inspecting the router.stack
    const paths = (router as any).stack.map((layer: any) => layer.path);
    expect(paths.some((p: string) => p.includes('posts'))).toBe(true);
  });

  it('getRouter() registers sub-resource routes for dotted resource names', () => {
    resourcer.define({ name: 'apps.menus' });
    const router = resourcer.getRouter();
    expect(router).toBeDefined();
    const stack = (router as any).stack;
    const routes = stack.map((layer: any) => ({
      path: layer.path,
      methods: layer.methods,
    }));

    // We expect routes like /api/apps/:parentId/menus
    const getListRoute = routes.find((r: any) => r.path === '/api/apps/:parentId/menus' && r.methods.includes('GET'));
    expect(getListRoute).toBeDefined();

    const postCreateRoute = routes.find((r: any) => r.path === '/api/apps/:parentId/menus' && r.methods.includes('POST'));
    expect(postCreateRoute).toBeDefined();

    const putUpdateRoute = routes.find((r: any) => r.path === '/api/apps/:parentId/menus/:id' && r.methods.includes('PUT'));
    expect(putUpdateRoute).toBeDefined();

    const deleteDestroyRoute = routes.find((r: any) => r.path === '/api/apps/:parentId/menus/:id' && r.methods.includes('DELETE'));
    expect(deleteDestroyRoute).toBeDefined();
  });

  it('use() registers global middleware', () => {
    const mw = vi.fn(async (_ctx: any, next: any) => next());
    resourcer.use(mw);
    // Middleware is stored — verify via middleware() callable
    const handler = resourcer.middleware();
    expect(handler).toBeTypeOf('function');
  });

  describe('dynamic fallback routing', () => {
    it('routes requests dynamically for active database collections', async () => {
      const dbMock = {
        hasCollection: vi.fn((name) => name === 'app_erp_suppliers'),
      };
      
      const router = resourcer.getRouter();
      const mockRoute = (router as any).stack.find((layer: any) => layer.path === '/api/:collectionName/:id?/:action?');
      expect(mockRoute).toBeDefined();

      const middleware = mockRoute.stack[mockRoute.stack.length - 1];

      const repoMock = {
        findAndCount: vi.fn().mockResolvedValue({ rows: [{ id: 1, name: 'Supplier A' }], count: 1 }),
      };
      const ctx: any = {
        method: 'GET',
        params: { collectionName: 'app_erp_suppliers' },
        db: dbMock,
        app: {
          db: {
            hasCollection: dbMock.hasCollection,
            getRepository: vi.fn().mockReturnValue(repoMock),
          },
        },
      };

      const nextFn = vi.fn(async () => {});
      await middleware(ctx, nextFn);

      expect(dbMock.hasCollection).toHaveBeenCalledWith('app_erp_suppliers');
      expect(resourcer.isDefined('app_erp_suppliers')).toBe(true);
      expect(ctx.action.resourceName).toBe('app_erp_suppliers');
      expect(ctx.action.actionName).toBe('list');
      expect(ctx.body.data).toEqual([{ id: 1, name: 'Supplier A' }]);
    });
  });
});

// ─── Default Actions ─────────────────────────────────────────────────────────

function makeCtx(overrides: any = {}): any {
  const action = {
    resourceName: 'posts',
    actionName: 'list',
    params: {},
    ...overrides.action,
  };

  return {
    status: 200,
    body: undefined,
    action,
    app: overrides.app ?? {},
    ...overrides,
  };
}

describe('default actions', () => {
  const next = vi.fn(async () => {});

  beforeEach(() => {
    next.mockClear();
  });

  describe('list', () => {
    it('calls repo.findAndCount and sets body with meta', async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const repo = {
        findAndCount: vi.fn().mockResolvedValue({ rows, count: 2 }),
      };
      const ctx = makeCtx({
        action: { resourceName: 'posts', actionName: 'list', params: { page: 1, pageSize: 10 } },
        app: { db: { getRepository: vi.fn().mockReturnValue(repo) } },
      });

      await list(ctx, next);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 10 }),
      );
      expect(ctx.body.data).toEqual(rows);
      expect(ctx.body.meta.count).toBe(2);
      expect(ctx.body.meta.page).toBe(1);
      expect(ctx.body.meta.pageSize).toBe(10);
      expect(ctx.body.meta.totalPages).toBe(1);
      expect(next).toHaveBeenCalled();
    });

    it('uses default page=1 pageSize=20 when not supplied', async () => {
      const repo = {
        findAndCount: vi.fn().mockResolvedValue({ rows: [], count: 0 }),
      };
      const ctx = makeCtx({
        action: { resourceName: 'posts', actionName: 'list', params: {} },
        app: { db: { getRepository: vi.fn().mockReturnValue(repo) } },
      });

      await list(ctx, next);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 }),
      );
    });
  });

  describe('get', () => {
    it('sets body with found record', async () => {
      const record = { id: 42, title: 'Hello' };
      const repo = { findById: vi.fn().mockResolvedValue(record) };
      const ctx = makeCtx({
        action: { resourceName: 'posts', actionName: 'get', params: { filterByTk: 42 } },
        app: { db: { getRepository: vi.fn().mockReturnValue(repo) } },
      });

      await get(ctx, next);

      expect(ctx.body.data).toEqual(record);
      expect(next).toHaveBeenCalled();
    });

    it('returns 404 when record not found', async () => {
      const repo = { findById: vi.fn().mockResolvedValue(null) };
      const ctx = makeCtx({
        action: { resourceName: 'posts', actionName: 'get', params: { filterByTk: 99 } },
        app: { db: { getRepository: vi.fn().mockReturnValue(repo) } },
      });

      await get(ctx, next);

      expect(ctx.status).toBe(404);
      expect(ctx.body.errors[0].code).toBe('NOT_FOUND');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('calls repo.create and returns record', async () => {
      const created = { id: 1, title: 'New Post' };
      const repo = { create: vi.fn().mockResolvedValue(created) };
      const ctx = makeCtx({
        action: {
          resourceName: 'posts',
          actionName: 'create',
          params: { values: { title: 'New Post' } },
        },
        app: { db: { getRepository: vi.fn().mockReturnValue(repo) } },
      });

      await create(ctx, next);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ values: { title: 'New Post' } }),
      );
      expect(ctx.body.data).toEqual(created);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('calls repo.update and returns updated records', async () => {
      const updated = [{ id: 1, title: 'Updated' }];
      const repo = { update: vi.fn().mockResolvedValue(updated) };
      const ctx = makeCtx({
        action: {
          resourceName: 'posts',
          actionName: 'update',
          params: { filterByTk: 1, values: { title: 'Updated' } },
        },
        app: { db: { getRepository: vi.fn().mockReturnValue(repo) } },
      });

      await update(ctx, next);

      expect(ctx.body.data).toEqual(updated);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('calls repo.destroy and returns count', async () => {
      const repo = { destroy: vi.fn().mockResolvedValue(1) };
      const ctx = makeCtx({
        action: {
          resourceName: 'posts',
          actionName: 'destroy',
          params: { filterByTk: 1 },
        },
        app: { db: { getRepository: vi.fn().mockReturnValue(repo) } },
      });

      await destroy(ctx, next);

      expect(repo.destroy).toHaveBeenCalledWith(
        expect.objectContaining({ filterByTk: 1 }),
      );
      expect(ctx.body.data).toBe(1);
      expect(next).toHaveBeenCalled();
    });

    it('safeguards against deleting with ids in body', async () => {
      const repo = { destroy: vi.fn().mockResolvedValue(2) };
      const ctx = makeCtx({
        action: {
          resourceName: 'posts',
          actionName: 'destroy',
          params: {},
        },
        request: {
          body: { ids: [10, 11] },
        },
        app: { db: { getRepository: vi.fn().mockReturnValue(repo) } },
      });

      await destroy(ctx, next);

      expect(repo.destroy).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { id: { $in: [10, 11] } },
        }),
      );
      expect(ctx.body.data).toBe(2);
      expect(next).toHaveBeenCalled();
    });

    it('blocks dangerous parameterless bulk deletes with a 400 error', async () => {
      const repo = { destroy: vi.fn() };
      const ctx = makeCtx({
        action: {
          resourceName: 'posts',
          actionName: 'destroy',
          params: {},
        },
        app: { db: { getRepository: vi.fn().mockReturnValue(repo) } },
      });

      await destroy(ctx, next);

      expect(ctx.status).toBe(400);
      expect(ctx.body.errors[0].code).toBe('MISSING_FILTER');
      expect(repo.destroy).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });
});
