import { NotificationChannel, NotificationPayload } from '../channels/base';
import { InAppNotificationChannel } from '../channels/in-app';
import { EmailNotificationChannel, EmailChannelConfig } from '../channels/email';

/**
 * Central notification service that dispatches notifications through registered channels.
 */
export class NotificationService {
  private channels: Map<string, NotificationChannel> = new Map();
  private db: any;

  constructor(db: any) {
    this.db = db;

    // Register the default in-app channel
    this.registerChannel(new InAppNotificationChannel(db));
  }

  /**
   * Register a notification channel.
   */
  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.type, channel);
  }

  /**
   * Get a registered channel by type.
   */
  getChannel(type: string): NotificationChannel | undefined {
    return this.channels.get(type);
  }

  /**
   * Send a notification through the specified channel(s).
   * If no channels are specified, sends through the in-app channel only.
   */
  async send(payload: NotificationPayload, channelTypes?: string[]): Promise<void> {
    const types = channelTypes || ['in-app'];

    for (const type of types) {
      const channel = this.channels.get(type);
      if (channel) {
        try {
          await channel.send(payload);
        } catch (err) {
          console.error(`[NotificationService] Failed to send via "${type}" channel:`, err);
        }
      } else {
        console.warn(`[NotificationService] Channel "${type}" not registered`);
      }
    }
  }

  /**
   * Send a notification to multiple users.
   */
  async sendToUsers(userIds: number[], payload: Omit<NotificationPayload, 'userId'>, channelTypes?: string[]): Promise<void> {
    for (const userId of userIds) {
      await this.send({ ...payload, userId }, channelTypes);
    }
  }

  /**
   * Initialize email channel with config from the notification_channels table.
   */
  async initEmailChannel(config?: EmailChannelConfig): Promise<void> {
    if (!this.channels.has('email')) {
      this.registerChannel(new EmailNotificationChannel(config));
    }
  }
}
