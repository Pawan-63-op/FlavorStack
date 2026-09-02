import { DispatchNotification } from '../../../../application/engagement/use-cases/DispatchNotification';
import { NotificationPreference } from '../../../../domain/engagement/entities/NotificationPreference';
import { NotificationTemplate } from '../../../../domain/engagement/entities/NotificationTemplate';
import { NOTIFICATION_CATEGORY } from '../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../domain/engagement/enums/notification-channel.enum';
import { Notification } from '../../../../domain/engagement/entities/Notification';
import {
  makeNotificationRepo,
  makePreferenceRepo,
  makeTemplateRepo,
  makeUnitOfWork,
  makeEventBus,
} from './_helpers';

function template(active = true): NotificationTemplate {
  const t = NotificationTemplate.create({
    key: 'order_confirmed',
    channel: NOTIFICATION_CHANNEL.INBOX,
    locale: 'en',
    titleTemplate: 'Order {{orderId}} confirmed',
    bodyTemplate: 'Hi {{name}}, your order is on its way',
  }).getValue();
  if (!active) t.deactivate();
  return t;
}

const dto = {
  recipientUserId: 'user-1',
  category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
  channel: NOTIFICATION_CHANNEL.INBOX,
  templateKey: 'order_confirmed',
  locale: 'en',
  vars: { orderId: '42', name: 'Pat' },
  sourceEventId: 'evt-1',
};

function build(opts: {
  preference?: NotificationPreference | null;
  template?: NotificationTemplate | null;
  existing?: Notification | null;
} = {}) {
  const notificationRepo = makeNotificationRepo({
    findByDedupeKey: jest.fn().mockResolvedValue(opts.existing ?? null),
  });
  const preferenceRepo = makePreferenceRepo({
    findByUserId: jest.fn().mockResolvedValue(opts.preference === undefined ? NotificationPreference.createDefault('user-1') : opts.preference),
  });
  const templateRepo = makeTemplateRepo({
    findByKeyChannelLocale: jest.fn().mockResolvedValue(opts.template === undefined ? template() : opts.template),
  });
  const uow = makeUnitOfWork();
  const bus = makeEventBus();
  const uc = new DispatchNotification(notificationRepo, preferenceRepo, templateRepo, uow);
  return { uc, notificationRepo, preferenceRepo, templateRepo, uow, bus };
}

/**
 * Phase 5 Batch 4: the notification-queue tier is gone. What remains is
 * dedupe → preference → template → render → `Notification.deliver` → save. Every dispatched row is
 * born SENT inside the unit-of-work transaction; there is no transport, no provider, no FAILED state.
 */
describe('DispatchNotification', () => {
  it('happy path: renders the template and persists a SENT row with no provider', async () => {
    const { uc, notificationRepo } = build();

    const result = await uc.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outcome).toBe('DISPATCHED');
    expect(result.getValue().dedupeKey).toBe('evt-1:ORDER_UPDATES');

    expect(notificationRepo.save).toHaveBeenCalledTimes(1);
    const saved = notificationRepo.save.mock.calls[0][0];
    expect(saved.status.value).toBe('SENT');
    expect(saved.sentAt).toBeInstanceOf(Date);
    expect(saved.provider).toBeUndefined();
    expect(saved.channel).toBe(NOTIFICATION_CHANNEL.INBOX);
    expect(saved.renderedTitle).toBe('Order 42 confirmed');
    expect(saved.renderedBody).toBe('Hi Pat, your order is on its way');
    expect(saved.dedupeKey).toBe('evt-1:ORDER_UPDATES');
  });

  it('persists the notification inside the unit-of-work transaction', async () => {
    const { uc, notificationRepo, uow } = build();
    await uc.execute(dto);
    expect(uow.runInTransaction).toHaveBeenCalledTimes(1);
    expect(notificationRepo.save).toHaveBeenCalledTimes(1);
  });

  it('skips when the channel is disabled for the category', async () => {
    const pref = NotificationPreference.createDefault('user-1');
    pref.setChannel(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.INBOX, false);
    const { uc, notificationRepo } = build({ preference: pref });

    const result = await uc.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outcome).toBe('SKIPPED');
    expect(result.getValue().reason).toBe('channel_disabled');
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });

  it('default-allows when the preference is missing', async () => {
    const { uc, notificationRepo } = build({ preference: null });

    const result = await uc.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outcome).toBe('DISPATCHED');
    expect(notificationRepo.save).toHaveBeenCalledTimes(1);
  });

  it('skips gracefully when the template is missing', async () => {
    const { uc, notificationRepo } = build({ template: null });

    const result = await uc.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outcome).toBe('SKIPPED');
    expect(result.getValue().reason).toBe('template_unavailable');
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });

  it('skips gracefully when the template is inactive', async () => {
    const { uc, notificationRepo } = build({ template: template(false) });

    const result = await uc.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outcome).toBe('SKIPPED');
    expect(result.getValue().reason).toBe('template_unavailable');
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });

  it('is idempotent: a duplicate dedupe key does not persist again', async () => {
    const existing = Notification.deliver({
      recipientUserId: 'user-1',
      category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
      channel: NOTIFICATION_CHANNEL.INBOX,
      templateKey: 'order_confirmed',
      renderedTitle: 't',
      renderedBody: 'b',
      dedupeKey: 'evt-1:ORDER_UPDATES',
    }).getValue();
    const { uc, notificationRepo } = build({ existing });

    const result = await uc.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outcome).toBe('SKIPPED');
    expect(result.getValue().reason).toBe('duplicate');
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });
});
