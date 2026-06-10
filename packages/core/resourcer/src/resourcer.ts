import Koa from 'koa';
import Router from '@koa/router';
import { Resource } from './resource';
import { ResourceOptions } from '@formai/shared';
import * as defaultActions from './default-actions';
import fs from 'fs';
import path from 'path';

const DEFAULT_ACTION_NAMES = ['list', 'get', 'create', 'update', 'destroy'] as const;

export class Resourcer {
  private resources: Map<string, Resource> = new Map();
  private middlewares: Koa.Middleware[] = [];

  define(options: ResourceOptions): Resource {
    const resource = new Resource(options);

    // Register default CRUD actions if not overridden by the resource
    for (const actionName of DEFAULT_ACTION_NAMES) {
      if (!resource.getAction(actionName)) {
        if (options.only && !options.only.includes(actionName)) continue;
        if (options.except && options.except.includes(actionName)) continue;
        resource.setAction(actionName, (defaultActions as any)[actionName]);
      }
    }

    this.resources.set(options.name, resource);
    return resource;
  }

  getResource(name: string): Resource | undefined {
    return this.resources.get(name);
  }

  isDefined(name: string): boolean {
    return this.resources.has(name);
  }

  use(middleware: Koa.Middleware): void {
    this.middlewares.push(middleware);
  }

  getRouter(): Router {
    const router = new Router({ prefix: '/api' });

    // Separate sub-resources (e.g. apps.menus) from standard resources (e.g. apps)
    // Register sub-resources first to prevent standard resource custom action wildcard routes 
    // (like POST /api/:resource/:id/:action) from shadowing/consuming more specific sub-resource routes
    // (like POST /api/:parent/:parentId/:child).
    const subResources: Resource[] = [];
    const standardResources: Resource[] = [];

    for (const resource of this.resources.values()) {
      if (resource.name.includes('.')) {
        subResources.push(resource);
      } else {
        standardResources.push(resource);
      }
    }

    const allResources = [...subResources, ...standardResources];

    for (const resource of allResources) {
      const name = resource.name;
      const resourceMiddlewares = resource.getMiddlewares();

      // Helper: build composed handler for a given action name
      const makeHandler = (actionName: string): Router.Middleware => {
        return async (ctx: any, next: () => Promise<void>) => {
          // Set action context
          ctx.action = ctx.action ?? {};
          ctx.action.resourceName = name;
          ctx.action.actionName = actionName;
          ctx.action.params = ctx.action.params ?? {};

          const handler = resource.getAction(actionName);
          if (!handler) {
            ctx.status = 404;
            ctx.body = { errors: [{ message: `Action "${actionName}" not found`, code: 'ACTION_NOT_FOUND' }] };
            return;
          }

          await handler(ctx, next);
        };
      };

      if (name.includes('.')) {
        const [parentName, childName] = name.split('.');

        // Sub-resource CRUD routes
        router.get(`/${parentName}/:parentId/${childName}`, ...resourceMiddlewares, async (ctx: any, next) => {
          ctx.action = ctx.action ?? {};
          ctx.action.params = ctx.action.params ?? {};
          ctx.action.params.filterByTk = ctx.params.parentId;
          await makeHandler('list')(ctx, next);
        });

        router.get(`/${parentName}/:parentId/${childName}/:id`, ...resourceMiddlewares, async (ctx: any, next) => {
          ctx.action = ctx.action ?? {};
          ctx.action.params = ctx.action.params ?? {};
          ctx.action.params.filterByTk = ctx.params.id;
          await makeHandler('get')(ctx, next);
        });

        router.post(`/${parentName}/:parentId/${childName}`, ...resourceMiddlewares, async (ctx: any, next) => {
          ctx.action = ctx.action ?? {};
          ctx.action.params = ctx.action.params ?? {};
          ctx.action.params.filterByTk = ctx.params.parentId;
          await makeHandler('create')(ctx, next);
        });

        router.put(`/${parentName}/:parentId/${childName}/:id`, ...resourceMiddlewares, async (ctx: any, next) => {
          ctx.action = ctx.action ?? {};
          ctx.action.params = ctx.action.params ?? {};
          ctx.action.params.filterByTk = ctx.params.id;
          await makeHandler('update')(ctx, next);
        });

        router.delete(`/${parentName}/:parentId/${childName}/:id`, ...resourceMiddlewares, async (ctx: any, next) => {
          ctx.action = ctx.action ?? {};
          ctx.action.params = ctx.action.params ?? {};
          ctx.action.params.filterByTk = ctx.params.id;
          await makeHandler('destroy')(ctx, next);
        });

        // Custom action with id: POST /api/:parentName/:parentId/:childName/:id/:action
        router.post(`/${parentName}/:parentId/${childName}/:id/:action`, ...resourceMiddlewares, async (ctx: any, next) => {
          ctx.action = ctx.action ?? {};
          ctx.action.params = ctx.action.params ?? {};
          ctx.action.params.filterByTk = ctx.params.id;
          await makeHandler(ctx.params.action)(ctx, next);
        });

        // Custom action without id: POST /api/:parentName/:parentId/:childName/:action
        router.post(`/${parentName}/:parentId/${childName}/:action`, ...resourceMiddlewares, async (ctx: any, next) => {
          const actionName = ctx.params.action;
          // Skip if it's a known CRUD action to avoid conflicts
          if (DEFAULT_ACTION_NAMES.includes(actionName as any)) {
            return next();
          }
          ctx.action = ctx.action ?? {};
          ctx.action.params = ctx.action.params ?? {};
          ctx.action.params.filterByTk = ctx.params.parentId;
          await makeHandler(actionName)(ctx, next);
        });
      } else {
        // Standard CRUD routes
        router.get(`/${name}`, ...resourceMiddlewares, makeHandler('list'));
        router.get(`/${name}/:id`, ...resourceMiddlewares, async (ctx: any, next) => {
          ctx.action = ctx.action ?? {};
          ctx.action.params = ctx.action.params ?? {};
          ctx.action.params.filterByTk = ctx.params.id;
          await makeHandler('get')(ctx, next);
        });
        router.post(`/${name}`, ...resourceMiddlewares, makeHandler('create'));
        router.put(`/${name}/:id`, ...resourceMiddlewares, async (ctx: any, next) => {
          ctx.action = ctx.action ?? {};
          ctx.action.params = ctx.action.params ?? {};
          ctx.action.params.filterByTk = ctx.params.id;
          await makeHandler('update')(ctx, next);
        });
        router.delete(`/${name}/:id`, ...resourceMiddlewares, async (ctx: any, next) => {
          ctx.action = ctx.action ?? {};
          ctx.action.params = ctx.action.params ?? {};
          ctx.action.params.filterByTk = ctx.params.id;
          await makeHandler('destroy')(ctx, next);
        });

        // Custom action with id: POST /api/:resource/:id/:action
        router.post(`/${name}/:id/:action`, ...resourceMiddlewares, async (ctx: any, next) => {
          const actionName = ctx.params.action;
          if (this.isDefined(`${name}.${actionName}`)) {
            return next();
          }
          ctx.action = ctx.action ?? {};
          ctx.action.params = ctx.action.params ?? {};
          ctx.action.params.filterByTk = ctx.params.id;
          await makeHandler(actionName)(ctx, next);
        });

        // Custom action without id: POST /api/:resource/:action
        router.post(`/${name}/:action`, ...resourceMiddlewares, async (ctx: any, next) => {
          const actionName = ctx.params.action;
          // Skip if it's a known CRUD action to avoid conflicts
          if (DEFAULT_ACTION_NAMES.includes(actionName as any)) {
            return next();
          }
          if (this.isDefined(`${name}.${actionName}`)) {
            return next();
          }
          await makeHandler(actionName)(ctx, next);
        });
      }
    }

    // ─── Dynamic Wildcard Collection Routing Fallback ─────────────────────────
    // Matches any dynamic database collections not registered during load() phase
    router.all('/:collectionName/:id?/:action?', async (ctx: any, next) => {
      // If a previous middleware or custom route has already handled and responded to the request, bypass fallback
      if (ctx.body !== undefined || (ctx.status && ctx.status !== 404)) {
        return next();
      }

      const { collectionName, id, action } = ctx.params;

      if (ctx.db && ctx.db.hasCollection(collectionName)) {
        let activeResourceName = collectionName;
        let actionName = 'list';
        let recordId = id;

        const isChildResource = action && !['export', 'import', 'destroy', 'create', 'update', 'get', 'list'].includes(action);

        if (isChildResource) {
          activeResourceName = `${collectionName}.${action}`;
          if (ctx.method === 'GET') {
            actionName = 'list';
          } else if (ctx.method === 'POST') {
            actionName = 'create';
          } else if (ctx.method === 'PUT' || ctx.method === 'PATCH') {
            actionName = 'update';
          } else if (ctx.method === 'DELETE') {
            actionName = 'destroy';
          }
        } else {
          if (ctx.method === 'GET') {
            actionName = recordId ? 'get' : 'list';
          } else if (ctx.method === 'POST') {
            if (recordId && action) {
              actionName = action;
            } else if (recordId && !action) {
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId);
              const isNumeric = !isNaN(Number(recordId));
              if (!isUuid && !isNumeric) {
                actionName = recordId;
                recordId = undefined;
              } else {
                actionName = 'create';
              }
            } else {
              actionName = 'create';
            }
          } else if (ctx.method === 'PUT' || ctx.method === 'PATCH') {
            actionName = 'update';
          } else if (ctx.method === 'DELETE') {
            actionName = 'destroy';
          }
        }

        if (!this.isDefined(activeResourceName)) {
          this.define({ name: activeResourceName });
        }

        const resource = this.getResource(activeResourceName);
        if (resource) {
          ctx.action = ctx.action ?? {};
          ctx.action.resourceName = activeResourceName;
          ctx.action.actionName = actionName;
          ctx.action.params = ctx.action.params ?? {};

          if (isChildResource) {
            if (id) {
              ctx.action.params.filterByTk = id;
            }
          } else {
            if (recordId) {
              ctx.action.params.filterByTk = recordId;
            }
          }

          const handler = resource.getAction(actionName);
          if (!handler) {
            ctx.status = 404;
            ctx.body = { errors: [{ message: `Action "${actionName}" not found`, code: 'ACTION_NOT_FOUND' }] };
            return;
          }

          const resourceMiddlewares = resource.getMiddlewares();
          const executeMiddlewares = async (index: number): Promise<void> => {
            if (index < resourceMiddlewares.length) {
              await resourceMiddlewares[index](ctx, () => executeMiddlewares(index + 1));
            } else {
              await handler(ctx, next);
            }
          };
          await executeMiddlewares(0);
          return;
        }
      }

      await next();
    });

    return router;
  }

  middleware(): Koa.Middleware {
    return async (ctx: any, next: () => Promise<void>) => {
      // Apply all registered middlewares in sequence
      for (const mw of this.middlewares) {
        await mw(ctx, async () => {});
      }
      await next();
    };
  }
}
