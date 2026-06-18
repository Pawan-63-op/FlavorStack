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
  makeNotificationQueue,
  makeUnitOfWork,
  makeOutbox,
  makeEventBus,
} from './_helpers';

function template(active = true): NotificationTemplate {
  const t = NotificationTemplate.create({
    key: 'order_confirmed',
    channel: NOTIFICATION_CHANNEL.EMAIL,
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
  channel: NOTIFICATION_CHANNEL.EMAIL,
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
  const outbox = makeOutbox();
  const bus = makeEventBus();
  const queue = makeNotificationQueue();
  const uc = new DispatchNotification(notificationRepo, preferenceRepo, templateRepo, uow, outbox, bus, queue);
  return { uc, notificationRepo, preferenceRepo, templateRepo, uow, outbox, bus, queue };
}

describe('DispatchNotification', () => {
  it('happy path: renders template, persists PENDING notification, enqueues exactly once', async () => {
    const { uc, notificationRepo, queue } = build();

    const result = await uc.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outcome).toBe('DISPATCHED');
    expect(result.getValue().dedupeKey).toBe('evt-1:ORDER_UPDATES');

    expect(notificationRepo.save).toHaveBeenCalledTimes(1);
    const saved = notificationRepo.save.mock.calls[0][0];
    expect(saved.status.value).toBe('PENDING');
    expect(saved.renderedTitle).toBe('Order 42 confirmed');
    expect(saved.renderedBody).toBe('Hi Pat, your order is on its way');
    expect(saved.dedupeKey).toBe('evt-1:ORDER_UPDATES');

    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    const [job, jobOpts] = queue.enqueue.mock.calls[0];
    expect(job).toEqual({ type: 'engagement', notificationId: saved.id.toString(), channel: 'EMAIL' });
    expect(jobOpts).toEqual({ jobId: 'evt-1-ORDER_UPDATES' });
  });

  it('persists the notification inside the unit-of-work transaction', async () => {
    const { uc, notificationRepo, uow } = build();
    await uc.execute(dto);
    expect(uow.runInTransaction).toHaveBeenCalledTimes(1);
    expect(notificationRepo.save).toHaveBeenCalledTimes(1);
  });

  it('skips when the channel is disabled for the category', async () => {
    const pref = NotificationPreference.createDefault('user-1');
    pref.setChannel(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.EMAIL, false);
    const { uc, notificationRepo, queue } = build({ preference: pref });

    const result = await uc.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outcome).toBe('SKIPPED');
    expect(result.getValue().reason).toBe('channel_disabled');
    expect(notificationRepo.save).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('default-allows when the preference is missing', async () => {
    const { uc, notificationRepo, queue } = build({ preference: null });

    const result = await uc.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outcome).toBe('DISPATCHED');
    expect(notificationRepo.save).toHaveBeenCalledTimes(1);
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('skips gracefully when the template is missing', async () => {
    const { uc, notificationRepo, queue } = build({ template: null });

    const result = await uc.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outcome).toBe('SKIPPED');
    expect(result.getValue().reason).toBe('template_unavailable');
    expect(notificationRepo.save).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('skips gracefully when the template is inactive', async () => {
    const { uc, notificationRepo, queue } = build({ template: template(false) });

    const result = await uc.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outcome).toBe('SKIPPED');
    expect(result.getValue().reason).toBe('template_unavailable');
    expect(notificationRepo.save).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('is idempotent: a duplicate dedupe key does not persist or enqueue again', async () => {
    const existing = Notification.queue({
      recipientUserId: 'user-1',
      category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      templateKey: 'order_confirmed',
      renderedTitle: 't',
      renderedBody: 'b',
      dedupeKey: 'evt-1:ORDER_UPDATES',
    }).getValue();
    const { uc, notificationRepo, queue } = build({ existing });

    const result = await uc.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outcome).toBe('SKIPPED');
    expect(result.getValue().reason).toBe('duplicate');
    expect(notificationRepo.save).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
