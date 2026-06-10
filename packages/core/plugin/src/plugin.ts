import { CollectionOptions, PluginOptions } from '@formai/shared';

export abstract class Plugin {
  app: any; // Application reference
  name: string;
  options: PluginOptions;
  private _enabled: boolean = true;

  constructor(app: any, options: PluginOptions) {
    this.app = app;
    this.name = options.name;
    this.options = options;
    if (options.enabled === false) {
      this._enabled = false;
    }
  }

  // Simplified lifecycle (4 hooks)
  async load(): Promise<void> {} // Register collections, routes, middleware
  async install(): Promise<void> {} // First-time install (seed data)
  async upgrade(): Promise<void> {} // Version upgrade migrations
  async destroy(): Promise<void> {} // Cleanup

  // Convenience accessors
  get db(): any {
    return this.app.db;
  }
  get acl(): any {
    return this.app.acl;
  }
  get resourcer(): any {
    return this.app.resourcer;
  }
  get enabled(): boolean {
    return this._enabled;
  }

  // Convenience methods
  defineCollection(options: CollectionOptions): any {
    return this.db.collection(options);
  }

  addMiddleware(middleware: any): void {
    this.app.use(middleware);
  }

  registerResource(options: any): void {
    this.app.resourcer.define(options);
  }

  /**
   * Register database migrations for this plugin.
   * Migrations run automatically during db.sync() or app.install().
   */
  addMigrations(migrations: any | any[]): void {
    this.db.addMigrations(migrations);
  }
}
