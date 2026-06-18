import { NotificationTemplate } from '../../../domain/engagement/entities/NotificationTemplate';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoNotificationTemplateRepository } from '../../../infrastructure/repositories/NotificationTemplateRepository';
import { NotificationTemplateModel } from '../../../infrastructure/database/models/NotificationTemplateModel';

function buildTemplate(key = 'welcome'): NotificationTemplate {
  return NotificationTemplate.create({
    key,
    channel: NOTIFICATION_CHANNEL.PUSH,
    locale: 'en',
    titleTemplate: 'Hi {{name}}',
    bodyTemplate: 'Welcome to FlavorStack, {{name}}!',
  }).getValue();
}

describe('MongoNotificationTemplateRepository', () => {
  let txContext: TransactionContext;
  let repo: MongoNotificationTemplateRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoNotificationTemplateRepository(txContext);
  });

  afterEach(async () => {
    await NotificationTemplateModel.deleteMany({});
  });

  it('round-trips a template through save + findByKeyChannelLocale', async () => {
    const template = buildTemplate();
    await repo.save(template);

    const found = await repo.findByKeyChannelLocale('welcome', NOTIFICATION_CHANNEL.PUSH, 'en');
    expect(found).toBeInstanceOf(NotificationTemplate);
    expect(found!.render({ name: 'Asha' })).toEqual({
      title: 'Hi Asha',
      body: 'Welcome to FlavorStack, Asha!',
    });
    expect(found!.active).toBe(true);
  });

  it('enforces a unique index on key+channel+locale', async () => {
    await repo.save(buildTemplate('dup_key'));
    await expect(repo.save(buildTemplate('dup_key'))).rejects.toThrow();
  });

  it('returns null when no template matches', async () => {
    const found = await repo.findByKeyChannelLocale('missing', NOTIFICATION_CHANNEL.EMAIL, 'en');
    expect(found).toBeNull();
  });
});
