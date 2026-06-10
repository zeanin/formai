import { Context, Next } from 'koa';

/**
 * List all roles
 */
export async function list(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('roles');
  const { filter, fields, sort, page = 1, pageSize = 50 } = (ctx as any).action.params;

  const { rows, count } = await repo.findAndCount({
    filter,
    fields,
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

/**
 * Get a single role
 */
export async function get(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('roles');
  const { filterByTk } = (ctx as any).action.params;

  const row = await repo.findOne({ filter: { name: filterByTk } });
  if (!row) {
    const byId = await repo.findById(filterByTk);
    if (!byId) {
      ctx.status = 404;
      ctx.body = { errors: [{ message: 'Role not found', code: 'NOT_FOUND' }] };
      return;
    }
    ctx.body = { data: byId };
    await next();
    return;
  }
  ctx.body = { data: row };
  await next();
}

/**
 * Create a new role
 */
export async function create(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('roles');
  const { values } = (ctx as any).action.params;

  if (!values?.name) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'Role name is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const record = await repo.create({
    values: {
      name: values.name,
      title: values.title || values.name,
      strategy: values.strategy || 'denyAll',
      snippets: values.snippets || [],
    },
  });

  // Also register the role in the in-memory ACL
  const acl = (ctx as any).app.acl;
  if (acl) {
    acl.defineRole(values.name, {
      strategy: values.strategy || 'denyAll',
      snippets: values.snippets || [],
    });
  }

  ctx.status = 201;
  ctx.body = { data: record };
  await next();
}

/**
 * Update a role
 */
export async function update(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('roles');
  const { filterByTk, values } = (ctx as any).action.params;

  const updated = await repo.update({
    filter: { name: filterByTk },
    values: {
      ...(values?.title ? { title: values.title } : {}),
      ...(values?.strategy ? { strategy: values.strategy } : {}),
      ...(values?.snippets ? { snippets: values.snippets } : {}),
    },
  });

  // Update the in-memory ACL
  if (values?.strategy || values?.snippets) {
    const acl = (ctx as any).app.acl;
    if (acl) {
      // Re-define the role with updated options
      const existing = await repo.findOne({ filter: { name: filterByTk } });
      if (existing) {
        acl.defineRole(filterByTk, {
          strategy: values.strategy || existing.strategy,
          snippets: values.snippets || existing.snippets || [],
        });
      }
    }
  }

  ctx.body = { data: updated };
  await next();
}

/**
 * Delete a role
 */
export async function destroy(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('roles');
  const { filterByTk } = (ctx as any).action.params;

  // Delete associated role resources and role users
  const resourcesRepo = (ctx as any).app.db.getRepository('roleResources');
  const usersRepo = (ctx as any).app.db.getRepository('roleUsers');

  const role = await repo.findOne({ filter: { name: filterByTk } });
  if (role) {
    if (resourcesRepo) await resourcesRepo.destroy({ filter: { roleId: role.id } });
    if (usersRepo) await usersRepo.destroy({ filter: { roleId: role.id } });
  }

  const count = await repo.destroy({ filter: { name: filterByTk } });
  ctx.body = { data: count };
  await next();
}

/**
 * Assign users to a role
 */
export async function setUsers(ctx: Context, next: Next): Promise<void> {
  const { filterByTk, values } = (ctx as any).action.params;
  const repo = (ctx as any).app.db.getRepository('roleUsers');

  if (!values?.userIds || !Array.isArray(values.userIds)) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'userIds array is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  // Find the role
  const rolesRepo = (ctx as any).app.db.getRepository('roles');
  const role = await rolesRepo.findOne({ filter: { name: filterByTk } });
  if (!role) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Role not found', code: 'NOT_FOUND' }] };
    return;
  }

  // Remove existing assignments
  await repo.destroy({ filter: { roleId: role.id } });

  // Create new assignments
  for (const userId of values.userIds) {
    await repo.create({ values: { roleId: role.id, userId } });
  }

  ctx.body = { data: { roleId: role.id, userIds: values.userIds } };
  await next();
}
