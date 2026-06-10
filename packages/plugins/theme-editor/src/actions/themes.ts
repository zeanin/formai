import { Context, Next } from 'koa';
import { ThemeService } from '../services/theme-service';
import { THEME_PRESETS } from '../types';
import type { ThemePreset } from '../types';

const themeService = new ThemeService();

export async function list(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('themes');
  const { filter, sort, page = 1, pageSize = 50 } = (ctx as any).action.params;
  const { rows, count } = await repo.findAndCount({
    filter,
    sort: sort || ['name'],
    page: Number(page),
    pageSize: Number(pageSize),
  });
  ctx.body = {
    data: rows,
    meta: { count, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(count / Number(pageSize)) },
  };
  await next();
}

export async function get(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('themes');
  const { filterByTk } = (ctx as any).action.params;
  const row = await repo.findById(filterByTk);
  if (!row) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Theme not found', code: 'NOT_FOUND' }] };
    return;
  }
  ctx.body = { data: row };
  await next();
}

export async function create(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('themes');
  const { values } = (ctx as any).action.params;

  if (!values?.name) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'name is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  // If a preset is specified, start from preset config and merge overrides
  let config = values.config || {};
  if (values.preset && THEME_PRESETS[values.preset as ThemePreset]) {
    config = themeService.mergeConfig(THEME_PRESETS[values.preset as ThemePreset], config);
  }

  const userId = (ctx as any).state?.currentUser?.id;
  const record = await repo.create({
    values: { name: values.name, config, isDefault: values.isDefault || false, createdById: userId },
  });

  ctx.status = 201;
  ctx.body = { data: record };
  await next();
}

export async function update(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('themes');
  const { filterByTk, values } = (ctx as any).action.params;

  const existing = await repo.findById(filterByTk);
  if (!existing) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Theme not found', code: 'NOT_FOUND' }] };
    return;
  }

  const updated = await repo.update({ filter: { id: filterByTk }, values });
  ctx.body = { data: updated };
  await next();
}

export async function destroy(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('themes');
  const { filterByTk } = (ctx as any).action.params;
  const count = await repo.destroy({ filter: { id: filterByTk } });
  ctx.body = { data: count };
  await next();
}

/**
 * POST /api/themes/:id/setDefault
 * Sets one theme as default and clears all others.
 */
export async function setDefault(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('themes');
  const { filterByTk } = (ctx as any).action.params;

  const theme = await repo.findById(filterByTk);
  if (!theme) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Theme not found', code: 'NOT_FOUND' }] };
    return;
  }

  // Clear all defaults
  await repo.update({ filter: {}, values: { isDefault: false } });
  // Set this one as default
  const updated = await repo.update({ filter: { id: filterByTk }, values: { isDefault: true } });

  ctx.body = { data: updated };
  await next();
}

/**
 * GET /api/themes/:id/css
 * Returns generated CSS variables for a theme.
 */
export async function getCss(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('themes');
  const { filterByTk } = (ctx as any).action.params;

  const theme = await repo.findById(filterByTk);
  if (!theme) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Theme not found', code: 'NOT_FOUND' }] };
    return;
  }

  const css = themeService.generateCssVariables(theme.config || {});
  ctx.set('Content-Type', 'text/css; charset=utf-8');
  ctx.body = css;
  await next();
}
