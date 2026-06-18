// Batch 4A — EmailChannel resolves the recipient email through INotificationRecipientResolver and
// delegates the actual send to the existing IEmailProvider (Resend). Missing email → deterministic
// Result.fail('no_recipient') (NOT an exception). Provider/transport errors propagate (so the worker
// can retry); the channel never swallows them.
import { EmailChannel } from '../../../../infrastructure/notifications/EmailChannel';
import { INotificationRecipientResolver } from '../../../../infrastructure/notifications/INotificationRecipientResolver';
import { IEmailProvider } from '../../../../domain/identity/services/IEmailProvider';
import { Email } from '../../../../domain/identity/value-objects/Email.vo';
import { Notification } from '../../../../domain/engagement/entities/Notification';
import { NOTIFICATION_CHANNEL } from '../../../../domain/engagement/enums/notification-channel.enum';
import { NOTIFICATION_CATEGORY } from '../../../../domain/engagement/enums/notification-category.enum';

function buildEmailNotification(): Notification {
  return Notification.queue({
    recipientUserId: 'user-1',
    category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
    channel: NOTIFICATION_CHANNEL.EMAIL,
    templateKey: 'order_confirmed',
    renderedTitle: 'Order confirmed',
    renderedBody: 'Your order is confirmed.',
    dedupeKey: 'evt-1:ORDER_UPDATES',
  }).getValue();
}

function makeResolver(over: Partial<INotificationRecipientResolver> = {}): INotificationRecipientResolver {
  return {
    resolveEmail: jest.fn(async () => 'alice@example.com'),
    resolvePushTokens: jest.fn(async () => ['tok']),
    ...over,
  };
}

function makeEmailProvider(): jest.Mocked<IEmailProvider> {
  return {
    sendVerification: jest.fn(async (_to: Email, _token: string) => {}),
    sendPasswordReset: jest.fn(async (_to: Email, _token: string) => {}),
    sendNotification: jest.fn(async (_to: Email, _subject: string, _body: string) => {}),
  };
}

describe('EmailChannel', () => {
  it('reports the EMAIL channel it serves', () => {
    const channel = new EmailChannel(makeEmailProvider(), makeResolver());
    expect(channel.channel).toBe(NOTIFICATION_CHANNEL.EMAIL);
  });

  it('resolves the email via the resolver and sends through IEmailProvider, returning the provider name', async () => {
    const provider = makeEmailProvider();
    const resolver = makeResolver();
    const channel = new EmailChannel(provider, resolver);

    const result = await channel.send(buildEmailNotification());

    expect(resolver.resolveEmail).toHaveBeenCalledWith('user-1');
    expect(provider.sendNotification).toHaveBeenCalledTimes(1);
    const [emailArg, subject, body] = provider.sendNotification.mock.calls[0];
    expect(emailArg.value).toBe('alice@example.com');
    expect(subject).toBe('Order confirmed');
    expect(body).toBe('Your order is confirmed.');
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().provider).toBe('resend');
  });

  it('returns Result.fail("no_recipient") when the resolver yields no email — no exception, no send', async () => {
    const provider = makeEmailProvider();
    const channel = new EmailChannel(provider, makeResolver({ resolveEmail: jest.fn(async () => null) }));

    const result = await channel.send(buildEmailNotification());

    expect(result.isFailure).toBe(true);
    expect(String(result.getError())).toContain('no_recipient');
    expect(provider.sendNotification).not.toHaveBeenCalled();
  });

  it('returns Result.fail("no_recipient") when the resolved email is malformed', async () => {
    const provider = makeEmailProvider();
    const channel = new EmailChannel(provider, makeResolver({ resolveEmail: jest.fn(async () => 'not-an-email') }));

    const result = await channel.send(buildEmailNotification());

    expect(result.isFailure).toBe(true);
    expect(String(result.getError())).toContain('no_recipient');
    expect(provider.sendNotification).not.toHaveBeenCalled();
  });

  it('lets provider/transport errors propagate so the worker can retry (does not swallow into a failure result)', async () => {
    const provider = makeEmailProvider();
    provider.sendNotification.mockRejectedValueOnce(new Error('resend 503'));
    const channel = new EmailChannel(provider, makeResolver());

    await expect(channel.send(buildEmailNotification())).rejects.toThrow('resend 503');
  });
});
