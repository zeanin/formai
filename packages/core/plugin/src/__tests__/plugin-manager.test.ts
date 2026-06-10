import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Plugin } from '../plugin';
import { PluginManager } from '../plugin-manager';
import { CircularDependencyError } from '../toposort';
import type { PluginOptions } from '@formai/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApp() {
  return {
    db: { collection: vi.fn() },
    acl: {},
    resourcer: { define: vi.fn() },
    use: vi.fn(),
  };
}

class SimplePlugin extends Plugin {
  loadCalled = false;
  installCalled = false;
  upgradeCalled = false;
  destroyCalled = false;

  async load() {
    this.loadCalled = true;
  }
  async install() {
    this.installCalled = true;
  }
  async upgrade() {
    this.upgradeCalled = true;
  }
  async destroy() {
    this.destroyCalled = true;
  }
}

class FailingPlugin extends Plugin {
  async load() {
    throw new Error('load failed');
  }
}

// ---------------------------------------------------------------------------
// Plugin base class
// ---------------------------------------------------------------------------

describe('Plugin base class', () => {
  it('stores name, options and app reference', () => {
    const app = makeApp();
    const plugin = new SimplePlugin(app, { name: 'simple' });
    expect(plugin.name).toBe('simple');
    expect(plugin.app).toBe(app);
    expect(plugin.options).toMatchObject({ name: 'simple' });
  });

  it('is enabled by default', () => {
    const plugin = new SimplePlugin(makeApp(), { name: 'p' });
    expect(plugin.enabled).toBe(true);
  });

  it('respects enabled:false in options', () => {
    const plugin = new SimplePlugin(makeApp(), { name: 'p', enabled: false });
    expect(plugin.enabled).toBe(false);
  });

  it('exposes db / acl / resourcer accessors', () => {
    const app = makeApp();
    const plugin = new SimplePlugin(app, { name: 'p' });
    expect(plugin.db).toBe(app.db);
    expect(plugin.acl).toBe(app.acl);
    expect(plugin.resourcer).toBe(app.resourcer);
  });

  it('defineCollection delegates to db.collection', () => {
    const app = makeApp();
    const plugin = new SimplePlugin(app, { name: 'p' });
    plugin.defineCollection({ name: 'posts', fields: [] });
    expect(app.db.collection).toHaveBeenCalledWith({ name: 'posts', fields: [] });
  });

  it('addMiddleware delegates to app.use', () => {
    const app = makeApp();
    const plugin = new SimplePlugin(app, { name: 'p' });
    const mw = vi.fn();
    plugin.addMiddleware(mw);
    expect(app.use).toHaveBeenCalledWith(mw);
  });

  it('registerResource delegates to resourcer.define', () => {
    const app = makeApp();
    const plugin = new SimplePlugin(app, { name: 'p' });
    plugin.registerResource({ name: 'posts' });
    expect(app.resourcer.define).toHaveBeenCalledWith({ name: 'posts' });
  });
});

// ---------------------------------------------------------------------------
// PluginManager – registration
// ---------------------------------------------------------------------------

describe('PluginManager – registration', () => {
  let manager: PluginManager;
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    app = makeApp();
    manager = new PluginManager(app);
  });

  it('add() registers a plugin class by name', () => {
    manager.add(SimplePlugin, { name: 'simple' });
    expect(manager.has('simple')).toBe(true);
  });

  it('addInstance() registers an existing plugin instance', () => {
    const plugin = new SimplePlugin(app, { name: 'inst' });
    manager.addInstance(plugin);
    expect(manager.has('inst')).toBe(true);
    expect(manager.get('inst')).toBe(plugin);
  });

  it('get() returns undefined for unknown plugins', () => {
    expect(manager.get('missing')).toBeUndefined();
  });

  it('getAll() returns all registered plugins', () => {
    manager.add(SimplePlugin, { name: 'a' });
    manager.add(SimplePlugin, { name: 'b' });
    expect(manager.getAll().length).toBe(2);
  });

  it('initial status is pending', () => {
    manager.add(SimplePlugin, { name: 'p' });
    expect(manager.getStatus('p')).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// PluginManager – lifecycle
// ---------------------------------------------------------------------------

describe('PluginManager – lifecycle: load → install', () => {
  let manager: PluginManager;
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    app = makeApp();
    manager = new PluginManager(app);
  });

  it('load() calls plugin.load() and sets status to loaded', async () => {
    manager.add(SimplePlugin, { name: 'p' });
    await manager.load();
    const plugin = manager.get('p') as SimplePlugin;
    expect(plugin.loadCalled).toBe(true);
    expect(manager.getStatus('p')).toBe('loaded');
  });

  it('install() calls plugin.install() and sets status to installed', async () => {
    manager.add(SimplePlugin, { name: 'p' });
    await manager.load();
    await manager.install();
    const plugin = manager.get('p') as SimplePlugin;
    expect(plugin.installCalled).toBe(true);
    expect(manager.getStatus('p')).toBe('installed');
  });

  it('upgrade() calls plugin.upgrade()', async () => {
    manager.add(SimplePlugin, { name: 'p' });
    await manager.load();
    await manager.upgrade();
    const plugin = manager.get('p') as SimplePlugin;
    expect(plugin.upgradeCalled).toBe(true);
  });

  it('destroy() calls plugin.destroy()', async () => {
    manager.add(SimplePlugin, { name: 'p' });
    await manager.load();
    await manager.destroy();
    const plugin = manager.get('p') as SimplePlugin;
    expect(plugin.destroyCalled).toBe(true);
  });

  it('install() skips plugins that are not in loaded status', async () => {
    manager.add(SimplePlugin, { name: 'p' });
    // Do NOT call load() first – status stays pending
    await manager.install();
    const plugin = manager.get('p') as SimplePlugin;
    expect(plugin.installCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PluginManager – enable / disable
// ---------------------------------------------------------------------------

describe('PluginManager – enable / disable', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager(makeApp());
    manager.add(SimplePlugin, { name: 'p' });
  });

  it('enable() sets status to enabled and plugin.enabled to true', async () => {
    await manager.enable('p');
    expect(manager.getStatus('p')).toBe('enabled');
    expect(manager.get('p')!.enabled).toBe(true);
  });

  it('disable() sets status to disabled and plugin.enabled to false', async () => {
    await manager.disable('p');
    expect(manager.getStatus('p')).toBe('disabled');
    expect(manager.get('p')!.enabled).toBe(false);
  });

  it('enable() / disable() on unknown name is a no-op', async () => {
    await expect(manager.enable('missing')).resolves.toBeUndefined();
    await expect(manager.disable('missing')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PluginManager – dependency order
// ---------------------------------------------------------------------------

describe('PluginManager – dependency resolution', () => {
  it('loads dependencies before dependents (A depends on B → B loads first)', async () => {
    const loadOrder: string[] = [];

    class TrackingPlugin extends Plugin {
      async load() {
        loadOrder.push(this.name);
      }
    }

    const app = makeApp();
    const manager = new PluginManager(app);
    // A depends on B – B must load first
    manager.add(TrackingPlugin, { name: 'A', dependencies: ['B'] });
    manager.add(TrackingPlugin, { name: 'B' });
    await manager.load();
    expect(loadOrder.indexOf('B')).toBeLessThan(loadOrder.indexOf('A'));
  });

  it('handles a chain: C→B→A (A loads first, then B, then C)', async () => {
    const loadOrder: string[] = [];

    class TrackingPlugin extends Plugin {
      async load() {
        loadOrder.push(this.name);
      }
    }

    const app = makeApp();
    const manager = new PluginManager(app);
    manager.add(TrackingPlugin, { name: 'C', dependencies: ['B'] });
    manager.add(TrackingPlugin, { name: 'B', dependencies: ['A'] });
    manager.add(TrackingPlugin, { name: 'A' });
    await manager.load();
    expect(loadOrder).toEqual(['A', 'B', 'C']);
  });

  it('destroy() runs in reverse load order', async () => {
    const destroyOrder: string[] = [];

    class TrackingPlugin extends Plugin {
      async destroy() {
        destroyOrder.push(this.name);
      }
    }

    const app = makeApp();
    const manager = new PluginManager(app);
    manager.add(TrackingPlugin, { name: 'A' });
    manager.add(TrackingPlugin, { name: 'B', dependencies: ['A'] });
    await manager.load();
    await manager.destroy();
    // Load order: A, B → destroy order: B, A
    expect(destroyOrder).toEqual(['B', 'A']);
  });
});

// ---------------------------------------------------------------------------
// PluginManager – circular dependency detection
// ---------------------------------------------------------------------------

describe('PluginManager – circular dependency detection', () => {
  it('throws CircularDependencyError for a direct cycle (A↔B)', async () => {
    const app = makeApp();
    const manager = new PluginManager(app);
    manager.add(SimplePlugin, { name: 'A', dependencies: ['B'] });
    manager.add(SimplePlugin, { name: 'B', dependencies: ['A'] });
    await expect(manager.load()).rejects.toThrow(CircularDependencyError);
  });

  it('throws CircularDependencyError for a triangle cycle (A→B→C→A)', async () => {
    const app = makeApp();
    const manager = new PluginManager(app);
    manager.add(SimplePlugin, { name: 'A', dependencies: ['C'] });
    manager.add(SimplePlugin, { name: 'B', dependencies: ['A'] });
    manager.add(SimplePlugin, { name: 'C', dependencies: ['B'] });
    await expect(manager.load()).rejects.toThrow(CircularDependencyError);
  });

  it('error message contains the cycle path', async () => {
    const app = makeApp();
    const manager = new PluginManager(app);
    manager.add(SimplePlugin, { name: 'X', dependencies: ['Y'] });
    manager.add(SimplePlugin, { name: 'Y', dependencies: ['X'] });
    try {
      await manager.load();
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CircularDependencyError);
      expect((err as CircularDependencyError).message).toMatch(/circular dependency/i);
      expect((err as CircularDependencyError).cycle.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// PluginManager – error handling during load
// ---------------------------------------------------------------------------

describe('PluginManager – error handling during load', () => {
  it('sets plugin status to error when load() throws', async () => {
    const app = makeApp();
    const manager = new PluginManager(app);
    manager.add(FailingPlugin, { name: 'failing' });
    await expect(manager.load()).rejects.toThrow('Failed to load plugin "failing"');
    expect(manager.getStatus('failing')).toBe('error');
  });

  it('error message wraps the original error', async () => {
    const app = makeApp();
    const manager = new PluginManager(app);
    manager.add(FailingPlugin, { name: 'failing' });
    await expect(manager.load()).rejects.toThrow('load failed');
  });

  it('stops loading subsequent plugins after a failure', async () => {
    const app = makeApp();
    const manager = new PluginManager(app);
    const loadOrder: string[] = [];

    class AfterPlugin extends Plugin {
      async load() {
        loadOrder.push(this.name);
      }
    }

    manager.add(FailingPlugin, { name: 'failing' });
    manager.add(AfterPlugin, { name: 'after', dependencies: ['failing'] });
    try {
      await manager.load();
    } catch {
      // expected
    }
    expect(loadOrder).not.toContain('after');
  });
});
