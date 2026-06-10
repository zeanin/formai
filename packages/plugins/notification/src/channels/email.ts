import { NotificationChannel, NotificationPayload } from './base';

/**
 * Email notification channel (skeleton).
 * In production, this would use nodemailer or a similar library.
 * Currently logs the notification for development purposes.
 */
export class EmailNotificationChannel implements NotificationChannel {
  type = 'email';
  private config: EmailChannelConfig;

  constructor(config?: EmailChannelConfig) {
    this.config = config || {
      host: 'localhost',
      port: 587,
      secure: false,
      from: 'noreply@example.com',
    };
  }

  async send(notification: NotificationPayload): Promise<void> {
    // Skeleton: in production, send actual email via SMTP
    // For now, log the notification
    console.log(
      `[EmailNotification] Would send email to user ${notification.userId}: "${notification.title}"`,
    );

    // Production implementation would look like:
    // const transporter = nodemailer.createTransport({
    //   host: this.config.host,
    //   port: this.config.port,
    //   secure: this.config.secure,
    //   auth: this.config.auth,
    // });
    // await transporter.sendMail({
    //   from: this.config.from,
    //   to: userEmail, // need to look up user email from DB
    //   subject: notification.title,
    //   text: notification.content || '',
    //   html: notification.data?.html,
    // });
  }
}

export interface EmailChannelConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from: string;
}
