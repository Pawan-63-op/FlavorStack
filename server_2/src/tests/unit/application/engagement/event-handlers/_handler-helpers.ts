import { Result } from '../../../../../domain/shared/Result';
import { DomainEvent } from '../../../../../domain/shared/DomainEvent';
import { DispatchNotification } from '../../../../../application/engagement/use-cases/DispatchNotification';
import { DispatchNotificationResponse } from '../../../../../application/engagement/dtos/DispatchNotificationDto';
import {
  IFulfillmentGateway,
  ReviewSubject,
} from '../../../../../domain/engagement/services/IFulfillmentGateway';
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

/**
 * Engagement's read window onto Fulfillment. Resolves a delivered fulfillment for
 * `cust-1` by default; pass `null` to simulate one that does not exist.
 */
export function makeFulfillmentGateway(
  subject: Partial<ReviewSubject> | null = {}
): jest.Mocked<IFulfillmentGateway> {
  return {
    getForReview: jest.fn().mockResolvedValue(
      subject === null
        ? null
        : {
            fulfillmentId: 'ful-1',
            customerId: 'cust-1',
            restaurantId: 'rest-1',
            deliveredAt: new Date('2026-01-01T00:00:00Z'),
            ...subject,
          }
    ),
  } as jest.Mocked<IFulfillmentGateway>;
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
