import { Context, Next } from 'koa';

/**
 * List notifications for the current user (or all if admin)
 */
export async function list(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('notifications');
  const currentUser = (ctx as any).state?.currentUser;
  const { filter, fields, sort, page = 1, pageSize = 20 } = (ctx as any).action.params;

  // Default: show only the current user's notifications
  const mergedFilter: any = { ...(filter || {}) };
  if (currentUser && !mergedFilter.userId) {
    mergedFilter.userId = currentUser.id;
  }

  const { rows, count } = await repo.findAndCount({
    filter: mergedFilter,
    fields,
    sort: sort || ['-createdAt'],
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
 * Mark a notification as read
 */
export async function markRead(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('notifications');
  const { filterByTk } = (ctx as any).action.params;

  if (!filterByTk) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'Notification id is required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  const notification = await repo.findById(filterByTk);
  if (!notification) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'Notification not found', code: 'NOT_FOUND' }] };
    return;
  }

  const updated = await repo.update({
    filterByTk,
    values: { read: true },
  });

  ctx.body = { data: updated };
  await next();
}

/**
 * Mark all notifications as read for the current user
 */
export async function markAllRead(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('notifications');
  const currentUser = (ctx as any).state?.currentUser;

  if (!currentUser) {
    ctx.status = 401;
    ctx.body = { errors: [{ message: 'Authentication required', code: 'UNAUTHORIZED' }] };
    return;
  }

  // Find all unread notifications for this user
  const unread = await repo.find({
    filter: { userId: currentUser.id, read: false },
  });

  // Mark each as read
  let updatedCount = 0;
  for (const notification of unread) {
    await repo.update({
      filterByTk: notification.id,
      values: { read: true },
    });
    updatedCount++;
  }

  ctx.body = { data: { markedAsRead: updatedCount } };
  await next();
}

/**
 * Get unread notification count for the current user
 */
export async function unreadCount(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('notifications');
  const currentUser = (ctx as any).state?.currentUser;

  if (!currentUser) {
    ctx.status = 401;
    ctx.body = { errors: [{ message: 'Authentication required', code: 'UNAUTHORIZED' }] };
    return;
  }

  const count = await repo.count({
    filter: { userId: currentUser.id, read: false },
  });

  ctx.body = { data: { count } };
  await next();
}
