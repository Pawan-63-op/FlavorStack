import { PushChannel } from '../../../../infrastructure/notifications/PushChannel';
import { INotificationRecipientResolver } from '../../../../infrastructure/notifications/INotificationRecipientResolver';
import { IPushProvider } from '../../../../infrastructure/external/push/IPushProvider';
import { Notification } from '../../../../domain/engagement/entities/Notification';
import { NOTIFICATION_CHANNEL } from '../../../../domain/engagement/enums/notification-channel.enum';
import { NOTIFICATION_CATEGORY } from '../../../../domain/engagement/enums/notification-category.enum';

function buildPushNotification(): Notification {
  return Notification.queue({
    recipientUserId: 'user-1',
    category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
    channel: NOTIFICATION_CHANNEL.PUSH,
    templateKey: 'order_confirmed',
    renderedTitle: 'Order confirmed',
    renderedBody: 'Your order is confirmed.',
    dedupeKey: 'evt-1:ORDER_UPDATES',
  }).getValue();
}

function makeResolver(over: Partial<INotificationRecipientResolver> = {}): INotificationRecipientResolver {
  return {
    resolveEmail: jest.fn(async () => 'alice@example.com'),
    resolvePushTokens: jest.fn(async () => ['tok-a', 'tok-b']),
    ...over,
  };
}

function makePushProvider(): jest.Mocked<IPushProvider> {
  return {
    sendPush: jest.fn(async (_token: string, _title: string, _body: string, _data?: Record<string, string>) => {}),
  };
}

describe('PushChannel', () => {
  it('reports the PUSH channel it serves', () => {
    const channel = new PushChannel(makePushProvider(), makeResolver());
    expect(channel.channel).toBe(NOTIFICATION_CHANNEL.PUSH);
  });

  it('resolves tokens via the resolver and pushes to every token, returning the provider name', async () => {
    const provider = makePushProvider();
    const resolver = makeResolver();
    const channel = new PushChannel(provider, resolver);

    const result = await channel.send(buildPushNotification());

    expect(resolver.resolvePushTokens).toHaveBeenCalledWith('user-1');
    expect(provider.sendPush).toHaveBeenCalledTimes(2);
    expect(provider.sendPush).toHaveBeenNthCalledWith(1, 'tok-a', 'Order confirmed', 'Your order is confirmed.');
    expect(provider.sendPush).toHaveBeenNthCalledWith(2, 'tok-b', 'Order confirmed', 'Your order is confirmed.');
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().provider).toBe('fcm');
  });

  it('returns Result.fail("no_recipient") when the user has no device tokens — no exception, no push', async () => {
    const provider = makePushProvider();
    const channel = new PushChannel(provider, makeResolver({ resolvePushTokens: jest.fn(async () => []) }));

    const result = await channel.send(buildPushNotification());

    expect(result.isFailure).toBe(true);
    expect(String(result.getError())).toContain('no_recipient');
    expect(provider.sendPush).not.toHaveBeenCalled();
  });

  it('lets provider errors propagate so the worker can retry', async () => {
    const provider = makePushProvider();
    provider.sendPush.mockRejectedValueOnce(new Error('fcm down'));
    const channel = new PushChannel(provider, makeResolver());

    await expect(channel.send(buildPushNotification())).rejects.toThrow('fcm down');
  });
});
