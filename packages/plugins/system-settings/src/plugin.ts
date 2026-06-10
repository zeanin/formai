import { Plugin } from '@formai/plugin';
import { Context, Next } from 'koa';
import { settingsCollection } from './collections/settings';
import * as settingsActions from './actions/settings';

export default class SystemSettingsPlugin extends Plugin {
  async load(): Promise<void> {
    // Register the settings collection
    this.defineCollection(settingsCollection);

    // Register resource actions (for resourcer-based access)
    this.registerResource({
      name: 'systemSettings',
      actions: {
        get: settingsActions.get,
        set: settingsActions.set,
        getAll: settingsActions.getAll,
      },
    });

    // Also expose clean REST routes at /api/system-settings
    this.addMiddleware(async (ctx: Context, next: Next) => {
      const path = ctx.path;
      const method = ctx.method;

      // GET /api/system-settings — list all settings
      if (path === '/api/system-settings' && method === 'GET') {
        const repo = (ctx as any).app.db.getRepository('systemSettings');
        const { group } = ctx.query;
        const filter = group ? { group } : {};
        const rows = await repo.find({ filter, sort: ['group', 'key'] });
        ctx.body = { data: rows };
        return;
      }

      // GET /api/system-settings/:key — get a single setting
      const getMatch = path.match(/^\/api\/system-settings\/([^/]+)$/);
      if (getMatch && method === 'GET') {
        const key = decodeURIComponent(getMatch[1]);
        const repo = (ctx as any).app.db.getRepository('systemSettings');
        const row = await repo.findOne({ filter: { key } });
        if (!row) {
          ctx.status = 404;
          ctx.body = { errors: [{ message: 'Setting not found', code: 'NOT_FOUND' }] };
          return;
        }
        ctx.body = { data: row };
        return;
      }

      // PUT /api/system-settings/:key — upsert a setting
      if (getMatch && (method === 'PUT' || method === 'PATCH')) {
        const key = decodeURIComponent(getMatch[1]);
        const repo = (ctx as any).app.db.getRepository('systemSettings');
        const body = (ctx as any).request.body as { value?: unknown; group?: string };
        const existing = await repo.findOne({ filter: { key } });
        if (existing) {
          const updated = await repo.update({
            filterByTk: existing.id,
            values: { value: body.value ?? existing.value, group: body.group || existing.group },
          });
          ctx.body = { data: updated };
        } else {
          const created = await repo.create({ values: { key, value: body.value ?? null, group: body.group || 'general' } });
          ctx.status = 201;
          ctx.body = { data: created };
        }
        return;
      }

      // POST /api/system-settings — bulk upsert
      if (path === '/api/system-settings' && method === 'POST') {
        const repo = (ctx as any).app.db.getRepository('systemSettings');
        const body = (ctx as any).request.body as { key: string; value: unknown; group?: string }[];
        const records = Array.isArray(body) ? body : [body];
        const results = [];
        for (const item of records) {
          if (!item.key) continue;
          const existing = await repo.findOne({ filter: { key: item.key } });
          if (existing) {
            const updated = await repo.update({
              filterByTk: existing.id,
              values: { value: item.value ?? existing.value, group: item.group || existing.group },
            });
            results.push(updated);
          } else {
            const created = await repo.create({ values: { key: item.key, value: item.value ?? null, group: item.group || 'general' } });
            results.push(created);
          }
        }
        ctx.body = { data: results };
        return;
      }

      await next();
    });
  }

  async install(): Promise<void> {
    const repo = this.db.getRepository('systemSettings');

    // Seed default settings
    const defaults = [
      { key: 'appName', value: 'Formai', group: 'general' },
      { key: 'appLogo', value: null, group: 'general' },
      { key: 'language', value: 'en-US', group: 'general' },
      { key: 'theme', value: 'light', group: 'ui' },
      { key: 'dateFormat', value: 'YYYY-MM-DD', group: 'general' },
      { key: 'timeFormat', value: 'HH:mm:ss', group: 'general' },
      { key: 'currency', value: 'USD', group: 'general' },
      { key: 'maxUploadSize', value: 50, group: 'storage' },
      { key: 'sessionTimeout', value: 86400, group: 'security' },
    ];

    for (const setting of defaults) {
      const existing = await repo.findOne({ filter: { key: setting.key } });
      if (!existing) {
        await repo.create({ values: setting });
      }
    }
  }
}
