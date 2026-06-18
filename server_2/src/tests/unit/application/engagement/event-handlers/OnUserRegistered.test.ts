import { OnUserRegistered } from '../../../../../application/engagement/event-handlers/OnUserRegistered';
import { NOTIFICATION_CATEGORY } from '../../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotificationDto } from '../../../../../application/engagement/dtos/DispatchNotificationDto';
import { Result } from '../../../../../domain/shared/Result';
import { logger } from '../../../../../infrastructure/observability/logger';
import { makeDispatch, asDispatch, makePreferenceRepo, busEvent } from './_handler-helpers';

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

describe('OnUserRegistered', () => {
  it('creates default preferences when the user has none, then dispatches the welcome notification', async () => {
    const dispatch = makeDispatch();
    const preferenceRepo = makePreferenceRepo();
    const handler = new OnUserRegistered(asDispatch(dispatch), preferenceRepo);

    await handler.handle(userRegistered());

    expect(preferenceRepo.findByUserId).toHaveBeenCalledWith('user-1');
    expect(preferenceRepo.save).toHaveBeenCalledTimes(1);
    const saved = preferenceRepo.save.mock.calls[0][0];
    expect(saved.userId).toBe('user-1');

    expect(dispatch.execute).toHaveBeenCalledTimes(1);
    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.recipientUserId).toBe('user-1');
    expect(dto.templateKey).toBe('welcome');
    expect(dto.category).toBe(NOTIFICATION_CATEGORY.SECURITY);
    expect(dto.channel).toBe(NOTIFICATION_CHANNEL.EMAIL);
    expect(dto.sourceEventId).toBe('evt-1');
    expect(dto.vars).toMatchObject({ name: 'Jane' });
  });

  it('does not recreate preferences when the user already has them', async () => {
    const dispatch = makeDispatch();
    const preferenceRepo = makePreferenceRepo({
      findByUserId: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    });
    const handler = new OnUserRegistered(asDispatch(dispatch), preferenceRepo);

    await handler.handle(userRegistered());

    expect(preferenceRepo.save).not.toHaveBeenCalled();
    expect(dispatch.execute).toHaveBeenCalledTimes(1);
  });

  it('is idempotent across redelivery of the same eventId', async () => {
    const dispatch = makeDispatch();
    const preferenceRepo = makePreferenceRepo();
    const handler = new OnUserRegistered(asDispatch(dispatch), preferenceRepo);

    const event = userRegistered();
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(1);
  });

  it('logs and does not dedupe when dispatch fails (allows retry)', async () => {
    const dispatch = makeDispatch();
    dispatch.execute
      .mockResolvedValueOnce(Result.fail('boom'))
      .mockResolvedValueOnce(Result.ok({ outcome: 'DISPATCHED', dedupeKey: 'k' }));
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const handler = new OnUserRegistered(asDispatch(dispatch), makePreferenceRepo());

    const event = userRegistered();
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
