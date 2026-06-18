import { OnPasswordChanged } from '../../../../../application/engagement/event-handlers/OnPasswordChanged';
import { OnPasswordResetRequested } from '../../../../../application/engagement/event-handlers/OnPasswordResetRequested';
import { NOTIFICATION_CATEGORY } from '../../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotificationDto } from '../../../../../application/engagement/dtos/DispatchNotificationDto';
import { Result } from '../../../../../domain/shared/Result';
import { logger } from '../../../../../infrastructure/observability/logger';
import { makeDispatch, asDispatch, busEvent } from './_handler-helpers';

describe('OnPasswordChanged', () => {
  it('dispatches a SECURITY email using the password_changed template', async () => {
    const dispatch = makeDispatch();
    const handler = new OnPasswordChanged(asDispatch(dispatch));

    await handler.handle(
      busEvent({ eventName: 'PasswordChanged', aggregateId: 'user-9', changedAt: new Date('2026-06-17T00:00:00Z') })
    );

    expect(dispatch.execute).toHaveBeenCalledTimes(1);
    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.recipientUserId).toBe('user-9');
    expect(dto.templateKey).toBe('password_changed');
    expect(dto.category).toBe(NOTIFICATION_CATEGORY.SECURITY);
    expect(dto.channel).toBe(NOTIFICATION_CHANNEL.EMAIL);
    expect(dto.sourceEventId).toBe('evt-1');
  });

  it('is idempotent across redelivery', async () => {
    const dispatch = makeDispatch();
    const handler = new OnPasswordChanged(asDispatch(dispatch));
    const event = busEvent({ eventName: 'PasswordChanged', aggregateId: 'user-9', changedAt: new Date() });

    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe a failed dispatch — a redelivery re-attempts', async () => {
    const dispatch = makeDispatch();
    dispatch.execute
      .mockResolvedValueOnce(Result.fail('boom'))
      .mockResolvedValueOnce(Result.ok({ outcome: 'DISPATCHED', dedupeKey: 'k' }));
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const handler = new OnPasswordChanged(asDispatch(dispatch));
    const event = busEvent({ eventName: 'PasswordChanged', aggregateId: 'user-9', changedAt: new Date() });

    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('OnPasswordResetRequested', () => {
  it('dispatches a SECURITY email using the password_reset template', async () => {
    const dispatch = makeDispatch();
    const handler = new OnPasswordResetRequested(asDispatch(dispatch));

    await handler.handle(
      busEvent({
        eventName: 'PasswordResetRequested',
        aggregateId: 'user-7',
        email: 'bob@example.com',
        requestedAt: new Date(),
      })
    );

    expect(dispatch.execute).toHaveBeenCalledTimes(1);
    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.recipientUserId).toBe('user-7');
    expect(dto.templateKey).toBe('password_reset');
    expect(dto.category).toBe(NOTIFICATION_CATEGORY.SECURITY);
    expect(dto.channel).toBe(NOTIFICATION_CHANNEL.EMAIL);
  });

  it('is idempotent across redelivery', async () => {
    const dispatch = makeDispatch();
    const handler = new OnPasswordResetRequested(asDispatch(dispatch));
    const event = busEvent({ eventName: 'PasswordResetRequested', aggregateId: 'user-7', email: 'b@e.com' });

    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe a failed dispatch — a redelivery re-attempts', async () => {
    const dispatch = makeDispatch();
    dispatch.execute
      .mockResolvedValueOnce(Result.fail('boom'))
      .mockResolvedValueOnce(Result.ok({ outcome: 'DISPATCHED', dedupeKey: 'k' }));
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const handler = new OnPasswordResetRequested(asDispatch(dispatch));
    const event = busEvent({ eventName: 'PasswordResetRequested', aggregateId: 'user-7', email: 'b@e.com' });

    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
