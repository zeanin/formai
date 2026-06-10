import { NotificationChannel, NotificationPayload } from './base';

/**
 * In-app notification channel.
 * Stores notifications in the database for the user to read later.
 * This is the default channel — it simply records the notification.
 */
export class InAppNotificationChannel implements NotificationChannel {
  type = 'in-app';
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async send(notification: NotificationPayload): Promise<void> {
    const repo = this.db.getRepository('notifications');
    await repo.create({
      values: {
        userId: notification.userId,
        title: notification.title,
        content: notification.content || null,
        type: notification.type || 'info',
        read: false,
      },
    });
  }
}
