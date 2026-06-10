import { Context, Next } from 'koa';

/**
 * List role-resource permission assignments
 */
export async function list(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('roleResources');
  const { filter, fields, sort, page = 1, pageSize = 100 } = (ctx as any).action.params;

  const { rows, count } = await repo.findAndCount({
    filter,
    fields,
    sort: sort || ['roleId', 'resource'],
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
 * Assign permissions for a role on a resource
 */
export async function assign(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('roleResources');
  const { values } = (ctx as any).action.params;

  if (!values?.roleName || !values?.resource) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'roleName and resource are required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  // Find the role to get its id
  const rolesRepo = (ctx as any).app.db.getRepository('roles');
  const role = await rolesRepo.findOne({ filter: { name: values.roleName } });
  if (!role) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Role not found', code: 'NOT_FOUND' }] };
    return;
  }

  // Upsert: find existing or create new
  const existing = await repo.findOne({
    filter: { roleId: role.id, resource: values.resource },
  });

  if (existing) {
    const updated = await repo.update({
      filterByTk: existing.id,
      values: { actions: values.actions || {} },
    });
    ctx.body = { data: updated };
  } else {
    const record = await repo.create({
      values: {
        roleId: role.id,
        resource: values.resource,
        actions: values.actions || {},
      },
    });
    ctx.status = 201;
    ctx.body = { data: record };
  }

  // Update in-memory ACL
  const acl = (ctx as any).app.acl;
  if (acl && values.actions) {
    const aclRole = acl.getRole(values.roleName);
    if (aclRole) {
      for (const [actionName, permission] of Object.entries(values.actions)) {
        aclRole.grant(values.resource, actionName, permission as any);
      }
    }
  }

  await next();
}

/**
 * Remove permissions for a role on a resource
 */
export async function remove(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('roleResources');
  const { values } = (ctx as any).action.params;

  if (!values?.roleName || !values?.resource) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'roleName and resource are required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const rolesRepo = (ctx as any).app.db.getRepository('roles');
  const role = await rolesRepo.findOne({ filter: { name: values.roleName } });
  if (!role) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Role not found', code: 'NOT_FOUND' }] };
    return;
  }

  const count = await repo.destroy({
    filter: { roleId: role.id, resource: values.resource },
  });

  // Update in-memory ACL
  const acl = (ctx as any).app.acl;
  if (acl && values.actions) {
    const aclRole = acl.getRole(values.roleName);
    if (aclRole) {
      for (const actionName of values.actions) {
        aclRole.revoke(values.resource, actionName);
      }
    }
  }

  ctx.body = { data: count };
  await next();
}
