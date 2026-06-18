import { UpdateNotificationPreferences } from '../../../../application/engagement/use-cases/UpdateNotificationPreferences';
import { GetNotificationPreferences } from '../../../../application/engagement/use-cases/GetNotificationPreferences';
import { NotificationPreference } from '../../../../domain/engagement/entities/NotificationPreference';
import { NOTIFICATION_CATEGORY } from '../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../domain/engagement/enums/notification-channel.enum';
import { makePreferenceRepo } from './_helpers';

describe('UpdateNotificationPreferences', () => {
  it('applies changes and persists when a preference already exists', async () => {
    const pref = NotificationPreference.createDefault('user-1');
    const repo = makePreferenceRepo({ findByUserId: jest.fn().mockResolvedValue(pref) });
    const uc = new UpdateNotificationPreferences(repo);

    const result = await uc.execute({
      userId: 'user-1',
      changes: [
        { category: NOTIFICATION_CATEGORY.ORDER_UPDATES, channel: NOTIFICATION_CHANNEL.EMAIL, enabled: false },
      ],
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().channels[NOTIFICATION_CATEGORY.ORDER_UPDATES].email).toBe(false);
    expect(result.getValue().channels[NOTIFICATION_CATEGORY.ORDER_UPDATES].push).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('creates a default preference first when none exists, then applies the change', async () => {
    const repo = makePreferenceRepo({ findByUserId: jest.fn().mockResolvedValue(null) });
    const uc = new UpdateNotificationPreferences(repo);

    const result = await uc.execute({
      userId: 'new-user',
      changes: [{ category: NOTIFICATION_CATEGORY.PROMOTIONS, channel: NOTIFICATION_CHANNEL.PUSH, enabled: false }],
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().userId).toBe('new-user');
    expect(result.getValue().channels[NOTIFICATION_CATEGORY.PROMOTIONS].push).toBe(false);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});

describe('GetNotificationPreferences', () => {
  it('returns the stored preference', async () => {
    const pref = NotificationPreference.createDefault('user-1');
    const repo = makePreferenceRepo({ findByUserId: jest.fn().mockResolvedValue(pref) });
    const uc = new GetNotificationPreferences(repo);

    const result = await uc.execute({ userId: 'user-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().userId).toBe('user-1');
    // PROMOTIONS is push-only by default
    expect(result.getValue().channels[NOTIFICATION_CATEGORY.PROMOTIONS].email).toBe(false);
  });

  it('returns a default (non-persisted) preference when none exists — default-allow', async () => {
    const repo = makePreferenceRepo({ findByUserId: jest.fn().mockResolvedValue(null) });
    const uc = new GetNotificationPreferences(repo);

    const result = await uc.execute({ userId: 'ghost' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().userId).toBe('ghost');
    expect(result.getValue().channels[NOTIFICATION_CATEGORY.ORDER_UPDATES].push).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
