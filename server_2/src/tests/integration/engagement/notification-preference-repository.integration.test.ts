import { NotificationPreference } from '../../../domain/engagement/entities/NotificationPreference';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoNotificationPreferenceRepository } from '../../../infrastructure/repositories/NotificationPreferenceRepository';
import { NotificationPreferenceModel } from '../../../infrastructure/database/models/NotificationPreferenceModel';

describe('MongoNotificationPreferenceRepository', () => {
  let txContext: TransactionContext;
  let repo: MongoNotificationPreferenceRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoNotificationPreferenceRepository(txContext);
  });

  afterEach(async () => {
    await NotificationPreferenceModel.deleteMany({});
  });

  it('round-trips a default preference, preserving ChannelToggle VO fidelity', async () => {
    const pref = NotificationPreference.createDefault('user-1');
    await repo.save(pref);

    const found = await repo.findByUserId('user-1');
    expect(found).toBeInstanceOf(NotificationPreference);
    const reloaded = found as NotificationPreference;

    expect(reloaded.userId).toBe('user-1');
    expect(reloaded.isEnabled(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.EMAIL)).toBe(true);
    expect(reloaded.isEnabled(NOTIFICATION_CATEGORY.PROMOTIONS, NOTIFICATION_CHANNEL.EMAIL)).toBe(false);
    expect(reloaded.isEnabled(NOTIFICATION_CATEGORY.PROMOTIONS, NOTIFICATION_CHANNEL.INBOX)).toBe(true);
  });

  it('round-trips a channel mutation through save then update', async () => {
    const pref = NotificationPreference.createDefault('user-2');
    await repo.save(pref);

    pref.setChannel(NOTIFICATION_CATEGORY.SECURITY, NOTIFICATION_CHANNEL.EMAIL, false);
    await repo.save(pref);

    const found = await repo.findByUserId('user-2');
    expect(found!.isEnabled(NOTIFICATION_CATEGORY.SECURITY, NOTIFICATION_CHANNEL.EMAIL)).toBe(false);
  });

  it('enforces a unique index on userId', async () => {
    const pref1 = NotificationPreference.createDefault('user-3');
    await repo.save(pref1);

    const pref2 = NotificationPreference.createDefault('user-3');
    await expect(repo.save(pref2)).rejects.toThrow();
  });

  it('returns null for an unknown userId', async () => {
    const found = await repo.findByUserId('does-not-exist');
    expect(found).toBeNull();
  });
});
