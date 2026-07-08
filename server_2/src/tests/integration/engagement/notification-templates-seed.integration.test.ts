import { runSeeds } from '../../../infrastructure/database/seeds';
import { NOTIFICATION_TEMPLATE_SEEDS } from '../../../infrastructure/database/seeds/notification-templates.seed';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoNotificationTemplateRepository } from '../../../infrastructure/repositories/NotificationTemplateRepository';
import { NotificationTemplateModel } from '../../../infrastructure/database/models/NotificationTemplateModel';

describe('Bootstrap notification-template seed (runSeeds)', () => {
  let repo: MongoNotificationTemplateRepository;

  beforeAll(async () => {
    await NotificationTemplateModel.init(); // build the unique (key,channel,locale) index up front
  });

  beforeEach(() => {
    repo = new MongoNotificationTemplateRepository(new TransactionContext());
  });

  afterEach(async () => {
    await NotificationTemplateModel.deleteMany({});
  });

  it('fresh database: creates every template automatically', async () => {
    const result = await runSeeds({ notificationTemplateRepo: repo });

    expect(result.notificationTemplatesCreated).toBe(NOTIFICATION_TEMPLATE_SEEDS.length);
    expect(await NotificationTemplateModel.countDocuments({})).toBe(NOTIFICATION_TEMPLATE_SEEDS.length);

    const welcome = NOTIFICATION_TEMPLATE_SEEDS.find((s) => s.key === 'welcome')!;
    const found = await repo.findByKeyChannelLocale('welcome', welcome.channel, 'en');
    expect(found).not.toBeNull();
  });

  it('repeated startup: is idempotent — no duplicates, nothing re-created', async () => {
    await runSeeds({ notificationTemplateRepo: repo });
    const second = await runSeeds({ notificationTemplateRepo: repo });

    expect(second.notificationTemplatesCreated).toBe(0);
    expect(await NotificationTemplateModel.countDocuments({})).toBe(NOTIFICATION_TEMPLATE_SEEDS.length);
  });

  it('partial existing set: creates only the missing templates', async () => {
    await runSeeds({ notificationTemplateRepo: repo });
    const welcome = NOTIFICATION_TEMPLATE_SEEDS.find((s) => s.key === 'welcome')!;
    await NotificationTemplateModel.deleteOne({ key: 'welcome', channel: welcome.channel, locale: 'en' });

    const again = await runSeeds({ notificationTemplateRepo: repo });

    expect(again.notificationTemplatesCreated).toBe(1);
    expect(await NotificationTemplateModel.countDocuments({})).toBe(NOTIFICATION_TEMPLATE_SEEDS.length);
  });
});
