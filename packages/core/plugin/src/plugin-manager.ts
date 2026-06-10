import { PluginOptions, PluginStatus } from '@formai/shared';
import { Plugin } from './plugin';
import { toposort } from './toposort';

export interface PluginRegistration {
  plugin: Plugin;
  status: PluginStatus;
  options: PluginOptions;
}

export class PluginManager {
  private plugins: Map<string, PluginRegistration> = new Map();
  private app: any;
  private loadOrder: string[] = []; // topologically sorted

  constructor(app: any) {
    this.app = app;
  }

  // Register a plugin class
  add(
    PluginClass: new (app: any, options: PluginOptions) => Plugin,
    options: PluginOptions,
  ): void {
    const plugin = new PluginClass(this.app, options);
    this.plugins.set(options.name, { plugin, status: 'pending', options });
  }

  // Add an already-instantiated plugin
  addInstance(plugin: Plugin): void {
    this.plugins.set(plugin.name, {
      plugin,
      status: 'pending',
      options: plugin.options,
    });
  }

  // Get a plugin by name
  get(name: string): Plugin | undefined {
    return this.plugins.get(name)?.plugin;
  }

  // Get plugin status
  getStatus(name: string): PluginStatus | undefined {
    return this.plugins.get(name)?.status;
  }

  // Check if plugin exists
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  // Get all plugins
  getAll(): Plugin[] {
    return Array.from(this.plugins.values()).map((r) => r.plugin);
  }

  // Load all plugins (respecting dependency order)
  async load(): Promise<void> {
    this.resolveLoadOrder();
    for (const name of this.loadOrder) {
      const reg = this.plugins.get(name)!;
      try {
        await reg.plugin.load();
        reg.status = 'loaded';
      } catch (err) {
        reg.status = 'error';
        throw new Error(`Failed to load plugin "${name}": ${(err as Error).message}`);
      }
    }
  }

  // Install all plugins
  async install(): Promise<void> {
    for (const name of this.loadOrder) {
      const reg = this.plugins.get(name)!;
      if (reg.status === 'loaded') {
        await reg.plugin.install();
        reg.status = 'installed';
      }
    }
  }

  // Upgrade all plugins
  async upgrade(): Promise<void> {
    for (const name of this.loadOrder) {
      const reg = this.plugins.get(name)!;
      await reg.plugin.upgrade();
    }
  }

  // Destroy all plugins (reverse order)
  async destroy(): Promise<void> {
    for (const name of [...this.loadOrder].reverse()) {
      const reg = this.plugins.get(name)!;
      await reg.plugin.destroy();
    }
  }

  // Enable a plugin
  async enable(name: string): Promise<void> {
    const reg = this.plugins.get(name);
    if (reg) {
      (reg.plugin as any)._enabled = true;
      reg.status = 'enabled';
    }
  }

  // Disable a plugin
  async disable(name: string): Promise<void> {
    const reg = this.plugins.get(name);
    if (reg) {
      (reg.plugin as any)._enabled = false;
      reg.status = 'disabled';
    }
  }

  // Topological sort based on dependencies
  private resolveLoadOrder(): void {
    const nodes = Array.from(this.plugins.values()).map((r) => ({
      name: r.options.name,
      dependencies: r.options.dependencies,
    }));
    this.loadOrder = toposort(nodes);
  }
}
