import { OnUserRegistered } from '../../../../../application/engagement/event-handlers/OnUserRegistered';
import { NotificationPreference } from '../../../../../domain/engagement/entities/NotificationPreference';
import { makePreferenceRepo, busEvent } from './_handler-helpers';

function userRegistered(overrides: Record<string, unknown> = {}) {
  return busEvent({
    eventName: 'UserRegistered',
    aggregateId: 'user-1',
    email: 'jane@example.com',
    role: 'customer',
    name: 'Jane',
    ...overrides,
  });
}

/**
 * Engagement's `OnUserRegistered` seeds default notification preferences and nothing else.
 * The welcome *email* moved to Identity's handler in Phase 5 Batch 3.
 */
describe('OnUserRegistered (engagement)', () => {
  it('creates default preferences when the user has none', async () => {
    const preferenceRepo = makePreferenceRepo();
    const handler = new OnUserRegistered(preferenceRepo);

    await handler.handle(userRegistered());

    expect(preferenceRepo.findByUserId).toHaveBeenCalledWith('user-1');
    expect(preferenceRepo.save).toHaveBeenCalledTimes(1);
    const saved = preferenceRepo.save.mock.calls[0][0];
    expect(saved.userId).toBe('user-1');
  });

  it('does not recreate preferences when the user already has them', async () => {
    const preferenceRepo = makePreferenceRepo({
      findByUserId: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    });
    const handler = new OnUserRegistered(preferenceRepo);

    await handler.handle(userRegistered());

    expect(preferenceRepo.save).not.toHaveBeenCalled();
  });

  // Phase 6 removed the per-handler in-memory `processedEventIds` set. The handler re-reads on
  // every delivery; the guard against a second write is the `findByUserId` existence check.
  it('re-checks on redelivery but does not write preferences twice', async () => {
    const preferenceRepo = makePreferenceRepo();
    preferenceRepo.findByUserId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(NotificationPreference.createDefault('user-1'));
    const handler = new OnUserRegistered(preferenceRepo);

    const event = userRegistered();
    await handler.handle(event);
    await handler.handle(event);

    expect(preferenceRepo.findByUserId).toHaveBeenCalledTimes(2);
    expect(preferenceRepo.save).toHaveBeenCalledTimes(1);
  });
});
