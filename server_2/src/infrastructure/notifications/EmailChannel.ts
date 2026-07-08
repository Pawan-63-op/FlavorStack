import { Result } from '../../domain/shared/Result';
import { Notification } from '../../domain/engagement/entities/Notification';
import { NOTIFICATION_CHANNEL, NotificationChannelValue } from '../../domain/engagement/enums/notification-channel.enum';
import { IEmailProvider } from '../../domain/identity/services/IEmailProvider';
import { Email } from '../../domain/identity/value-objects/Email.vo';
import { INotificationRecipientResolver } from './INotificationRecipientResolver';
import { ChannelSendResult, INotificationChannel, NO_RECIPIENT } from './INotificationChannel';

const PROVIDER = 'resend';

export class EmailChannel implements INotificationChannel {
  public readonly channel: NotificationChannelValue = NOTIFICATION_CHANNEL.EMAIL;

  constructor(
    private readonly emailProvider: IEmailProvider,
    private readonly resolver: INotificationRecipientResolver
  ) {}

  async send(notification: Notification): Promise<Result<ChannelSendResult>> {
    const address = await this.resolver.resolveEmail(notification.recipientUserId);
    if (!address) return Result.fail<ChannelSendResult>(NO_RECIPIENT);

    const email = Email.create(address);
    if (email.isFailure) return Result.fail<ChannelSendResult>(NO_RECIPIENT);

    await this.emailProvider.sendNotification(email.getValue(), notification.renderedTitle, notification.renderedBody);

    return Result.ok<ChannelSendResult>({ provider: PROVIDER });
  }
}
