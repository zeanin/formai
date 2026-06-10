/**
 * Base interface for notification channels.
 * Implementations handle the actual delivery of notifications.
 */
export interface NotificationChannel {
  /** Unique name for this channel type */
  type: string;

  /** Send a notification through this channel */
  send(notification: NotificationPayload): Promise<void>;
}

export interface NotificationPayload {
  userId: number;
  title: string;
  content?: string;
  type?: string;
  data?: Record<string, any>;
}
