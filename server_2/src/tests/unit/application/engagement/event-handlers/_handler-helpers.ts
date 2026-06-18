// Shared mock factories + event builders for the engagement cross-context event-handler tests.
// Mirrors the inline-mock style of OnOrderRequested.test.ts but extracted to cut duplication across
// the nine handler suites.
import { Result } from '../../../../../domain/shared/Result';
import { DomainEvent } from '../../../../../domain/shared/DomainEvent';
import { DispatchNotification } from '../../../../../application/engagement/use-cases/DispatchNotification';
import { DispatchNotificationResponse } from '../../../../../application/engagement/dtos/DispatchNotificationDto';
import { IReviewEligibilityRepository } from '../../../../../domain/engagement/repositories/IReviewEligibilityRepository';
import { INotificationPreferenceRepository } from '../../../../../domain/engagement/repositories/INotificationPreferenceRepository';

/** A DispatchNotification test double whose execute() returns a DISPATCHED result by default. */
export function makeDispatch(
  response: Partial<DispatchNotificationResponse> = {}
): jest.Mocked<Pick<DispatchNotification, 'execute'>> {
  const execute = jest.fn().mockResolvedValue(
    Result.ok<DispatchNotificationResponse>({
      outcome: 'DISPATCHED',
      dedupeKey: 'evt:CATEGORY',
      notificationId: 'notif-1',
      ...response,
    })
  );
  return { execute } as unknown as jest.Mocked<Pick<DispatchNotification, 'execute'>>;
}

export function asDispatch(stub: jest.Mocked<Pick<DispatchNotification, 'execute'>>): DispatchNotification {
  return stub as unknown as DispatchNotification;
}

export function makeEligibilityRepo(
  overrides: Partial<IReviewEligibilityRepository> = {}
): jest.Mocked<IReviewEligibilityRepository> {
  return {
    findByFulfillmentId: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(undefined),
    markReviewed: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<IReviewEligibilityRepository>;
}

export function makePreferenceRepo(
  overrides: Partial<INotificationPreferenceRepository> = {}
): jest.Mocked<INotificationPreferenceRepository> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findByUserId: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as jest.Mocked<INotificationPreferenceRepository>;
}

/** Build a rehydrated bus event (canonical DomainEvent fields + spread payload). */
export function busEvent(overrides: Record<string, unknown>): DomainEvent {
  return {
    eventId: 'evt-1',
    occurredOn: new Date(),
    ...overrides,
  } as unknown as DomainEvent;
}
