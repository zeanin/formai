import type { Context, Next } from 'koa';

// ─── App Menus Actions ────────────────────────────────────────────────────────

/**
 * List menus for an app, returned as a flat list (tree assembly on frontend).
 * When called by end users, filters based on their permissions.
 */
export async function list(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const currentRole = (ctx as any).state.currentRole;
  const currentUser = (ctx as any).state.currentUser;
  const { filterByTk: appId } = (ctx as any).action?.params || {};

  if (!appId) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'appId is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const appsRepo = db.getRepository('apps');
  const app = await appsRepo.findOne({
    filter: isNaN(Number(appId)) ? { name: appId } : { id: appId },
  });

  if (!app) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'App not found', code: 'NOT_FOUND' }] };
    return;
  }

  const isAdmin = currentRole === 'root' || currentRole === 'admin' || currentRole === 'developer';

  // All menus for this app (sorted by sort asc)
  const menusRepo = db.getRepository('appMenus');
  const menus = await menusRepo.find({
    filter: { appId: app.id },
    sort: ['sort', 'id'],
  });

  let filtered = menus;

  // For non-admin users, filter by their permissions
  if (!isAdmin && currentUser) {
    const assignments = await db.getRepository('userAppRoles').find({
      filter: { userId: currentUser.id, appId: app.id },
    });
    const roleIds = assignments.map((a: any) => a.appRoleId);
    const roles = await db.getRepository('appRoles').find({ filter: { id: { $in: roleIds } } });
    const permissions: Set<string> = new Set(roles.flatMap((r: any) => r.permissions || []));

    // wildcard means full access
    if (!permissions.has('*')) {
      filtered = menus.filter((m: any) => {
        if (m.hidden) return false;
        if (!m.permissionKey) return true; // no permission key = public within app
        return permissions.has(m.permissionKey);
      });
    }
  }

  ctx.body = { data: filtered.map(serializeMenu), meta: { appId: app.id, appName: app.name } };
  await next();
}

export async function create(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk: appId, values } = (ctx as any).action?.params || {};

  const appsRepo = db.getRepository('apps');
  const app = await appsRepo.findOne({
    filter: isNaN(Number(appId)) ? { name: appId } : { id: appId },
  });

  if (!app) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'App not found', code: 'NOT_FOUND' }] };
    return;
  }

  if (!values?.title) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'title is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  // Determine next sort position
  const menusRepo = db.getRepository('appMenus');
  const lastMenu = await menusRepo.findOne({
    filter: { appId: app.id, parentId: values.parentId || null },
    sort: ['-sort'],
  });
  const sort = lastMenu ? lastMenu.sort + 10 : 10;

  const menu = await menusRepo.create({
    values: {
      appId: app.id,
      title: values.title,
      icon: values.icon || null,
      type: values.type || 'page',
      schemaUid: values.schemaUid || null,
      url: values.url || null,
      parentId: values.parentId || null,
      sort,
      permissionKey: values.permissionKey || null,
      path: values.path || slugify(values.title),
      hidden: values.hidden || false,
    },
  });

  ctx.status = 201;
  ctx.body = { data: serializeMenu(menu) };
  await next();
}

export async function update(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk: menuId, values } = (ctx as any).action?.params || {};

  const menusRepo = db.getRepository('appMenus');
  const menu = await menusRepo.findOne({ filter: { id: menuId } });
  if (!menu) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Menu not found', code: 'NOT_FOUND' }] };
    return;
  }

  const allowed = ['title', 'icon', 'type', 'schemaUid', 'url', 'parentId', 'sort', 'permissionKey', 'path', 'hidden'];
  const updateData: any = {};
  for (const key of allowed) {
    if (values?.[key] !== undefined) updateData[key] = values[key];
  }

  const updated = await menusRepo.update({ filterByTk: menuId, values: updateData });
  ctx.body = { data: serializeMenu(updated[0] || menu) };
  await next();
}

export async function destroy(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk: menuId } = (ctx as any).action?.params || {};

  const menusRepo = db.getRepository('appMenus');
  const menu = await menusRepo.findOne({ filter: { id: menuId } });
  if (!menu) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Menu not found', code: 'NOT_FOUND' }] };
    return;
  }

  // Also delete children
  await menusRepo.destroy({ filter: { parentId: menuId } });
  await menusRepo.destroy({ filterByTk: menuId });

  ctx.body = { data: { success: true } };
  await next();
}

export async function reorder(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { values } = (ctx as any).action?.params || {};

  if (!values || !Array.isArray(values.items)) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'items array is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const menusRepo = db.getRepository('appMenus');
  for (const item of values.items) {
    if (item.id !== undefined) {
      await menusRepo.update({
        filterByTk: item.id,
        values: {
          parentId: item.parentId !== undefined ? item.parentId : null,
          sort: item.sort !== undefined ? item.sort : 0,
        },
      });
    }
  }

  ctx.body = { data: { success: true } };
  await next();
}


// ─── App Roles Actions ────────────────────────────────────────────────────────

export async function listRoles(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk: appId } = (ctx as any).action?.params || {};

  const appsRepo = db.getRepository('apps');
  const app = await appsRepo.findOne({
    filter: isNaN(Number(appId)) ? { name: appId } : { id: appId },
  });

  if (!app) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'App not found', code: 'NOT_FOUND' }] };
    return;
  }

  const rolesRepo = db.getRepository('appRoles');
  const roles = await rolesRepo.find({
    filter: { appId: app.id },
    sort: ['name'],
  });

  ctx.body = { data: roles.map(serializeRole) };
  await next();
}

export async function createRole(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk: appId, values } = (ctx as any).action?.params || {};

  const appsRepo = db.getRepository('apps');
  const app = await appsRepo.findOne({
    filter: isNaN(Number(appId)) ? { name: appId } : { id: appId },
  });

  if (!app) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'App not found', code: 'NOT_FOUND' }] };
    return;
  }

  if (!values?.name || !values?.title) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'name and title are required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const rolesRepo = db.getRepository('appRoles');
  const role = await rolesRepo.create({
    values: {
      appId: app.id,
      name: values.name,
      title: values.title,
      permissions: values.permissions || [],
      isDefault: values.isDefault || false,
    },
  });

  ctx.status = 201;
  ctx.body = { data: serializeRole(role) };
  await next();
}

export async function updateRole(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk: roleId, values } = (ctx as any).action?.params || {};

  const rolesRepo = db.getRepository('appRoles');
  const role = await rolesRepo.findOne({ filter: { id: roleId } });
  if (!role) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Role not found', code: 'NOT_FOUND' }] };
    return;
  }

  const allowed = ['title', 'permissions', 'isDefault'];
  const updateData: any = {};
  for (const key of allowed) {
    if (values?.[key] !== undefined) updateData[key] = values[key];
  }

  const updated = await rolesRepo.update({ filterByTk: roleId, values: updateData });
  ctx.body = { data: serializeRole(updated[0] || role) };
  await next();
}

// ─── User-App Role Assignments ────────────────────────────────────────────────

export async function assignUserRole(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { values } = (ctx as any).action?.params || {};

  if (!values?.userId || !values?.appRoleId) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'userId and appRoleId are required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const rolesRepo = db.getRepository('appRoles');
  const role = await rolesRepo.findOne({ filter: { id: values.appRoleId } });
  if (!role) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'App role not found', code: 'NOT_FOUND' }] };
    return;
  }

  // Manual findOrCreate: check if assignment exists, create if not
  const userAppRolesRepo = db.getRepository('userAppRoles');
  let assignment = await userAppRolesRepo.findOne({
    filter: { userId: values.userId, appRoleId: values.appRoleId },
  });
  if (!assignment) {
    assignment = await userAppRolesRepo.create({
      values: { userId: values.userId, appRoleId: values.appRoleId, appId: role.appId },
    });
  }

  ctx.status = 201;
  ctx.body = { data: assignment };
  await next();
}

export async function removeUserRole(ctx: Context, next: Next): Promise<void> {
  const db = (ctx as any).app.db;
  const { filterByTk } = (ctx as any).action?.params || {};

  await db.getRepository('userAppRoles').destroy({ filterByTk });
  ctx.body = { data: { success: true } };
  await next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50);
}

function serializeMenu(menu: any) {
  return {
    id: menu.id,
    appId: menu.appId,
    title: menu.title,
    icon: menu.icon,
    type: menu.type,
    schemaUid: menu.schemaUid,
    url: menu.url,
    parentId: menu.parentId,
    sort: menu.sort,
    permissionKey: menu.permissionKey,
    path: menu.path,
    hidden: menu.hidden,
  };
}

function serializeRole(role: any) {
  return {
    id: role.id,
    appId: role.appId,
    name: role.name,
    title: role.title,
    permissions: role.permissions || [],
    isDefault: role.isDefault,
  };
}
