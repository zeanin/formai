import { Plugin } from '@formai/plugin';
import { Context, Next } from 'koa';
import { notificationsCollection, notificationChannelsCollection } from './collections/notifications';
import * as notificationActions from './actions/notifications';
import { NotificationService } from './services/notification-service';
import { EmailChannelConfig } from './channels/email';

export interface NotificationPluginOptions {
  email?: EmailChannelConfig;
}

export default class NotificationPlugin extends Plugin {
  private notificationService!: NotificationService;
  private notificationOptions: NotificationPluginOptions;

  constructor(app: any, options: any) {
    super(app, options);
    this.notificationOptions = options?.notification || {};
  }

  async load(): Promise<void> {
    // Register collections
    this.defineCollection(notificationsCollection);
    this.defineCollection(notificationChannelsCollection);

    // Initialize the notification service
    this.notificationService = new NotificationService(this.db);

    // Set up email channel if configured
    if (this.notificationOptions.email) {
      await this.notificationService.initEmailChannel(this.notificationOptions.email);
    }

    // Make the notification service available on the app
    this.app.notificationService = this.notificationService;

    // Register resource actions (resourcer-based)
    this.registerResource({
      name: 'notifications',
      actions: {
        list: notificationActions.list,
        markRead: notificationActions.markRead,
        markAllRead: notificationActions.markAllRead,
        unreadCount: notificationActions.unreadCount,
      },
    });

    // Expose clean REST routes at /api/notifications
    const svc = this.notificationService;
    this.addMiddleware(async (ctx: Context, next: Next) => {
      const path = ctx.path;
      const method = ctx.method;
      const currentUser = (ctx as any).state?.currentUser;

      // GET /api/notifications — list for current user
      if (path === '/api/notifications' && method === 'GET') {
        const repo = (ctx as any).app.db.getRepository('notifications');
        const page = Number(ctx.query.page ?? 1);
        const pageSize = Number(ctx.query.pageSize ?? 20);
        const filter: any = {};
        if (currentUser) filter.userId = currentUser.id;
        if (ctx.query.read !== undefined) filter.read = ctx.query.read === 'true';

        const { rows, count } = await repo.findAndCount({
          filter,
          sort: ['-createdAt'],
          page,
          pageSize,
        });
        ctx.body = { data: rows, meta: { count, page, pageSize, totalPages: Math.ceil(count / pageSize) } };
        return;
      }

      // GET /api/notifications/unread-count
      if (path === '/api/notifications/unread-count' && method === 'GET') {
        const repo = (ctx as any).app.db.getRepository('notifications');
        const filter: any = { read: false };
        if (currentUser) filter.userId = currentUser.id;
        const count = await repo.count({ filter });
        ctx.body = { data: { count } };
        return;
      }

      // POST /api/notifications/mark-all-read
      if (path === '/api/notifications/mark-all-read' && method === 'POST') {
        if (!currentUser) { ctx.status = 401; ctx.body = { errors: [{ message: 'Unauthorized' }] }; return; }
        const repo = (ctx as any).app.db.getRepository('notifications');
        const unread = await repo.find({ filter: { userId: currentUser.id, read: false } });
        for (const n of unread) {
          await repo.update({ filterByTk: n.id, values: { read: true } });
        }
        ctx.body = { data: { markedAsRead: unread.length } };
        return;
      }

      // PATCH /api/notifications/:id/read — mark one as read
      const readMatch = path.match(/^\/api\/notifications\/(\d+)\/read$/);
      if (readMatch && method === 'PATCH') {
        const id = Number(readMatch[1]);
        const repo = (ctx as any).app.db.getRepository('notifications');
        const updated = await repo.update({ filterByTk: id, values: { read: true } });
        ctx.body = { data: updated };
        return;
      }

      // POST /api/notifications — create / send an in-app notification (admin)
      if (path === '/api/notifications' && method === 'POST') {
        const body = (ctx as any).request.body as { userId: number; title: string; content?: string; type?: string };
        if (!body.userId || !body.title) {
          ctx.status = 400;
          ctx.body = { errors: [{ message: 'userId and title are required' }] };
          return;
        }
        await svc.send({
          userId: body.userId,
          title: body.title,
          content: body.content,
          type: (body.type as any) || 'info',
        });
        ctx.status = 201;
        ctx.body = { data: { sent: true } };
        return;
      }

      await next();
    });
  }

  async install(): Promise<void> {
    // Seed default notification channels
    const channelsRepo = this.db.getRepository('notificationChannels');

    const defaultChannels = [
      { name: 'in-app', type: 'in-app', config: {}, enabled: true },
      { name: 'email', type: 'email', config: this.notificationOptions.email || {}, enabled: false },
    ];

    for (const channel of defaultChannels) {
      const existing = await channelsRepo.findOne({ filter: { name: channel.name } });
      if (!existing) {
        await channelsRepo.create({ values: channel });
      }
    }
  }

  /**
   * Get the notification service instance (for use by other plugins)
   */
  getNotificationService(): NotificationService {
    return this.notificationService;
  }
}
