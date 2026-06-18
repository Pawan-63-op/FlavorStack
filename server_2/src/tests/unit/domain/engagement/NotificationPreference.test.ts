import { NotificationPreference } from '../../../../domain/engagement/entities/NotificationPreference';
import { NOTIFICATION_CATEGORY } from '../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../domain/engagement/enums/notification-channel.enum';

describe('NotificationPreference.createDefault', () => {
  it('enables all categories on all channels except PROMOTIONS which is push-only', () => {
    const pref = NotificationPreference.createDefault('user-1');

    expect(pref.userId).toBe('user-1');
    expect(pref.isEnabled(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.PUSH)).toBe(true);
    expect(pref.isEnabled(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.EMAIL)).toBe(true);
    expect(pref.isEnabled(NOTIFICATION_CATEGORY.DELIVERY, NOTIFICATION_CHANNEL.PUSH)).toBe(true);
    expect(pref.isEnabled(NOTIFICATION_CATEGORY.SECURITY, NOTIFICATION_CHANNEL.EMAIL)).toBe(true);
    expect(pref.isEnabled(NOTIFICATION_CATEGORY.PROMOTIONS, NOTIFICATION_CHANNEL.PUSH)).toBe(true);
    expect(pref.isEnabled(NOTIFICATION_CATEGORY.PROMOTIONS, NOTIFICATION_CHANNEL.EMAIL)).toBe(false);
  });
});

describe('NotificationPreference.setChannel / isEnabled', () => {
  it('updates a single category/channel toggle', () => {
    const pref = NotificationPreference.createDefault('user-1');
    const result = pref.setChannel(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.EMAIL, false);

    expect(result.isSuccess).toBe(true);
    expect(pref.isEnabled(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.EMAIL)).toBe(false);
    expect(pref.isEnabled(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.PUSH)).toBe(true);
  });

  it('bumps updatedAt on change', () => {
    const pref = NotificationPreference.createDefault('user-1');
    const before = pref.updatedAt;
    pref.setChannel(NOTIFICATION_CATEGORY.DELIVERY, NOTIFICATION_CHANNEL.PUSH, false);
    expect(pref.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('default-allows a category that has no stored toggle', () => {
    const pref = NotificationPreference.createDefault('user-1');
    // ORDER_UPDATES, DELIVERY, SECURITY, PROMOTIONS are all seeded; isEnabled must still
    // default-allow for any category absent from the map (defensive behavior).
    expect(pref.isEnabled('UNKNOWN_CATEGORY' as any, NOTIFICATION_CHANNEL.PUSH)).toBe(true);
  });

  it('rejects an invalid category on setChannel', () => {
    const pref = NotificationPreference.createDefault('user-1');
    const result = pref.setChannel('BOGUS' as any, NOTIFICATION_CHANNEL.PUSH, true);
    expect(result.isFailure).toBe(true);
  });

  it('rejects a null channel on setChannel', () => {
    const pref = NotificationPreference.createDefault('user-1');
    const result = pref.setChannel(NOTIFICATION_CATEGORY.ORDER_UPDATES, null as any, true);
    expect(result.isFailure).toBe(true);
  });
});
