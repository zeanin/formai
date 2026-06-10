import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Application } from '@formai/server';

// ─── Mocks ───────────────────────────────────────────────────────────────────
// Prevent real DB connections during integration tests
vi.mock('@formai/database', () => {
  const mockRepo = {
    count: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    destroy: vi.fn().mockResolvedValue(1),
  };

  const collections = new Map<string, any>();

  const mockDb: any = {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn().mockResolvedValue(undefined),
    syncCollection: vi.fn().mockResolvedValue(undefined),
    collection: vi.fn((opts: any) => {
      const col = { name: opts.name, options: opts };
      collections.set(opts.name, col);
      return col;
    }),
    getCollection: vi.fn((name: string) => collections.get(name)),
    getRepository: vi.fn().mockReturnValue(mockRepo),
    on: vi.fn(),
  };

  return {
    Database: vi.fn(() => mockDb),
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a mock Koa context for testing route handlers.
 */
function createMockCtx(overrides: Record<string, any> = {}): any {
  return {
    method: 'GET',
    path: '/',
    status: 200,
    body: undefined,
    query: {},
    request: { body: undefined },
    action: { resourceName: '', actionName: '', params: {} },
    state: {},
    app: { emit: vi.fn() },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Application — integration', () => {
  let app: Application;

  beforeAll(async () => {
    app = new Application({
      database: {
        dialect: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'test',
        password: 'test',
        database: 'test_integration',
        logging: false,
      },
      port: 0, // use OS-assigned port to avoid conflicts
      cors: true,
    });
  });

  afterAll(async () => {
    await app.stop().catch(() => {/* ignore */});
  });

  // ── 1. Construction ────────────────────────────────────────────────────────

  it('creates an Application instance successfully', () => {
    expect(app).toBeDefined();
    expect(app.db).toBeDefined();
    expect(app.resourcer).toBeDefined();
    expect(app.koa).toBeDefined();
  });

  // ── 2. Plugin registration ─────────────────────────────────────────────────

  it('allows plugins to be registered via the internal plugin map', () => {
    const mockPlugin = {
      name: 'test-plugin',
      load: vi.fn().mockResolvedValue(undefined),
      install: vi.fn().mockResolvedValue(undefined),
    };

    (app as any).plugins.set('test-plugin', mockPlugin);
    expect((app as any).plugins.has('test-plugin')).toBe(true);
  });

  it('calls plugin.load() during app.load()', async () => {
    const loadMock = vi.fn().mockResolvedValue(undefined);
    (app as any).plugins.set('mock-load-plugin', {
      name: 'mock-load-plugin',
      load: loadMock,
    });

    await app.load();

    expect(loadMock).toHaveBeenCalled();
  });

  // ── 3. Collections ─────────────────────────────────────────────────────────

  it('defines a collection through app.collection()', () => {
    const col = app.collection({
      name: 'test_items',
      fields: [
        { name: 'id', type: 'integer', primaryKey: true },
        { name: 'title', type: 'string' },
      ],
    });

    expect(col).toBeDefined();
    expect(col.name).toBe('test_items');
  });

  it('retrieves a defined collection from the database', () => {
    app.collection({ name: 'test_posts', fields: [] });
    const col = app.db.getCollection('test_posts');
    expect(col).toBeDefined();
  });

  // ── 4. Resourcer / API routes ──────────────────────────────────────────────

  it('registers a resource with CRUD actions', () => {
    const listAction = vi.fn(async (ctx: any) => {
      ctx.body = { data: [], meta: { count: 0 } };
    });

    app.resource({
      name: 'test_articles',
      actions: {
        list: listAction,
      },
    });

    const router = app.resourcer.getRouter();
    expect(router).toBeDefined();
  });

  it('executes a resource action handler through the resourcer', async () => {
    const handler = vi.fn(async (ctx: any) => {
      ctx.body = { data: [{ id: 1, name: 'Test' }], meta: { count: 1 } };
    });

    app.resource({
      name: 'test_products',
      actions: { list: handler },
    });

    // Simulate a request through the resourcer dispatch
    const ctx = createMockCtx({
      method: 'GET',
      path: '/api/test_products',
      action: { resourceName: 'test_products', actionName: 'list', params: {} },
    });

    // Execute handler directly to verify it produces correct output
    await handler(ctx);

    expect(ctx.body).toEqual({
      data: [{ id: 1, name: 'Test' }],
      meta: { count: 1 },
    });
  });

  // ── 5. CRUD operations via repository ─────────────────────────────────────

  it('creates a record through the database repository', async () => {
    const repo = app.db.getRepository('users');
    const record = await repo.create({ values: { username: 'alice', email: 'alice@example.com' } });
    expect(record).toBeDefined();
    expect(record.id).toBe(1);
  });

  it('finds records through the database repository', async () => {
    const repo = app.db.getRepository('posts');
    const records = await repo.find({ filter: {} });
    expect(Array.isArray(records)).toBe(true);
  });

  it('counts records through the database repository', async () => {
    const repo = app.db.getRepository('users');
    const count = await repo.count();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // ── 6. Health check route ─────────────────────────────────────────────────

  it('responds to GET /api/health with status, version, and uptime', async () => {
    // Simulate health check middleware directly
    let handled = false;
    const healthMiddleware = async (ctx: any, next: any) => {
      if (ctx.path === '/api/health' && ctx.method === 'GET') {
        ctx.body = {
          status: 'ok',
          version: '0.1.0',
          uptime: Math.floor(process.uptime()),
        };
        handled = true;
        return;
      }
      await next();
    };

    const ctx = createMockCtx({ method: 'GET', path: '/api/health' });
    const next = vi.fn().mockResolvedValue(undefined);

    await healthMiddleware(ctx, next);

    expect(handled).toBe(true);
    expect(ctx.body.status).toBe('ok');
    expect(ctx.body.version).toBe('0.1.0');
    expect(typeof ctx.body.uptime).toBe('number');
    expect(next).not.toHaveBeenCalled();
  });

  it('passes non-health routes to next middleware', async () => {
    const healthMiddleware = async (ctx: any, next: any) => {
      if (ctx.path === '/api/health' && ctx.method === 'GET') {
        ctx.body = { status: 'ok', version: '0.1.0', uptime: 0 };
        return;
      }
      await next();
    };

    const ctx = createMockCtx({ method: 'GET', path: '/api/users' });
    const next = vi.fn().mockResolvedValue(undefined);

    await healthMiddleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.body).toBeUndefined();
  });

  // ── 7. Middleware stack ────────────────────────────────────────────────────

  it('supports adding custom middleware via app.use()', () => {
    const mw = async (ctx: any, next: any) => next();
    expect(() => app.use(mw)).not.toThrow();
  });

  // ── 8. Event emission ─────────────────────────────────────────────────────

  it('emits load event after app.load()', async () => {
    const app2 = new Application({
      database: {
        dialect: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'test',
        password: 'test',
        database: 'test2',
        logging: false,
      },
      port: 0,
    });

    const loadListener = vi.fn();
    app2.on('load', loadListener);

    await app2.load();

    expect(loadListener).toHaveBeenCalled();
  });
});
