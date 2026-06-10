import { Plugin } from '@formai/plugin';
import { appsCollection } from './collections/apps';
import { appMenusCollection, appRolesCollection, userAppRolesCollection } from './collections/app-menus';
import { compilationTasksCollection } from './collections/compilation-tasks';
import { CompilerWorker } from './actions/compiler-worker';
import * as appActions from './actions/apps';
import * as menuActions from './actions/app-menus';

export default class AppsPlugin extends Plugin {
  private worker: CompilerWorker | null = null;

  async load(): Promise<void> {
    // Register collections
    this.defineCollection(appsCollection);
    this.defineCollection(appMenusCollection);
    this.defineCollection(appRolesCollection);
    this.defineCollection(userAppRolesCollection);
    this.defineCollection(compilationTasksCollection);

    // ─── Apps resource ────────────────────────────────────────────────────────
    this.registerResource({
      name: 'apps',
      actions: {
        list: appActions.list,
        get: appActions.get,
        create: appActions.create,
        update: appActions.update,
        destroy: appActions.destroy,
        publish: appActions.publish,
        unpublish: appActions.unpublish,
        archive: appActions.archive,
        'auto-update': appActions.autoUpdateApp,
      },
    });

    // ─── App Menus resource ───────────────────────────────────────────────────
    // Route: GET/POST /api/apps/:appId/menus
    this.registerResource({
      name: 'apps.menus',
      actions: {
        list: menuActions.list,
        create: menuActions.create,
        update: menuActions.update,
        destroy: menuActions.destroy,
        reorder: menuActions.reorder,
      },
    });

    // ─── App Roles resource ───────────────────────────────────────────────────
    this.registerResource({
      name: 'apps.roles',
      actions: {
        list: menuActions.listRoles,
        create: menuActions.createRole,
        update: menuActions.updateRole,
      },
    });

    // ─── User-App Role assignments ────────────────────────────────────────────
    this.registerResource({
      name: 'userAppRoles',
      actions: {
        create: menuActions.assignUserRole,
        destroy: menuActions.removeUserRole,
      },
    });

    // ─── My apps & permissions (uses custom Koa routes) ───────────────────────
    const router = this.app.router;
    if (router) {
      router.get('/api/my/apps', appActions.myApps);
      router.get('/api/my/permissions', appActions.myPermissions);
      router.get('/api/apps/:appName/stats', appActions.appStats);
      router.post('/api/apps/:id/auto-update', appActions.autoUpdateApp);
      router.get('/api/apps/:id/compilation/active', appActions.activeCompilation);
      router.get('/api/apps/:id/compilation/stream', appActions.compilationStream);
      router.post('/api/apps/:id/compilation/reset', appActions.resetCompilation);
      router.post('/api/apps/:id/wiki/sync', appActions.syncWiki);
    }

    // Initialize and start background compiler worker
    this.worker = new CompilerWorker(this.app);
    this.worker.start();
  }

  async install(): Promise<void> {
    // Sync tables
    await this.db.syncCollection('apps', { alter: true });
    await this.db.syncCollection('appMenus', { alter: true });
    await this.db.syncCollection('appRoles', { alter: true });
    await this.db.syncCollection('userAppRoles', { alter: true });
    await this.db.syncCollection('compilationTasks', { alter: true });
  }

  async destroy(): Promise<void> {
    if (this.worker) {
      this.worker.stop();
      this.worker = null;
    }
  }
}

