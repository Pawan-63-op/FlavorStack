import { Result } from '../../domain/shared/Result';
import { Notification } from '../../domain/engagement/entities/Notification';
import { NOTIFICATION_CHANNEL, NotificationChannelValue } from '../../domain/engagement/enums/notification-channel.enum';
import { IPushProvider } from '../external/push/IPushProvider';
import { INotificationRecipientResolver } from './INotificationRecipientResolver';
import { ChannelSendResult, INotificationChannel, NO_RECIPIENT } from './INotificationChannel';

const PROVIDER = 'fcm';

export class PushChannel implements INotificationChannel {
  public readonly channel: NotificationChannelValue = NOTIFICATION_CHANNEL.PUSH;

  constructor(
    private readonly pushProvider: IPushProvider,
    private readonly resolver: INotificationRecipientResolver
  ) {}

  async send(notification: Notification): Promise<Result<ChannelSendResult>> {
    const tokens = await this.resolver.resolvePushTokens(notification.recipientUserId);
    if (!tokens || tokens.length === 0) return Result.fail<ChannelSendResult>(NO_RECIPIENT);

    for (const token of tokens) {
      await this.pushProvider.sendPush(token, notification.renderedTitle, notification.renderedBody);
    }

    return Result.ok<ChannelSendResult>({ provider: PROVIDER });
  }
}
