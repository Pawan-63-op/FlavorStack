import { IUnitOfWork } from '../../../../application/shared/ports/IUnitOfWork';
import { IEventBus } from '../../../../application/shared/events/IEventBus';
import {
  IReviewRepository,
  RestaurantRatingAggregate,
} from '../../../../domain/engagement/repositories/IReviewRepository';
import {
  IFulfillmentGateway,
  ReviewSubject,
} from '../../../../domain/engagement/services/IFulfillmentGateway';
import { INotificationRepository } from '../../../../domain/engagement/repositories/INotificationRepository';
import { INotificationPreferenceRepository } from '../../../../domain/engagement/repositories/INotificationPreferenceRepository';
import { INotificationTemplateRepository } from '../../../../domain/engagement/repositories/INotificationTemplateRepository';

export function makeUnitOfWork(): IUnitOfWork {
  return { runInTransaction: jest.fn(<T>(work: (ctx: unknown) => Promise<T>) => work({})) };
}

export function makeEventBus(): jest.Mocked<IEventBus> {
  return {
    subscribe: jest.fn(),
    publish: jest.fn().mockResolvedValue(undefined),
    publishAll: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<IEventBus>;
}

export function makeReviewRepo(overrides: Partial<IReviewRepository> = {}): jest.Mocked<IReviewRepository> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findByCustomerAndFulfillment: jest.fn().mockResolvedValue(null),
    findByRestaurant: jest.fn().mockResolvedValue([]),
    findByCustomer: jest.fn().mockResolvedValue([]),
    findByModerationStatus: jest.fn().mockResolvedValue([]),
    aggregateRating: jest.fn().mockResolvedValue(zeroRating('rest-1')),
    ...overrides,
  } as jest.Mocked<IReviewRepository>;
}

/** The all-zero aggregate a restaurant with no APPROVED reviews resolves to. */
export function zeroRating(restaurantId: string): RestaurantRatingAggregate {
  return {
    restaurantId,
    avgRating: 0,
    reviewCount: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
}

/** A delivered, reviewable fulfillment by default; pass `null` for "no such fulfillment". */
export function makeFulfillmentGateway(
  subject: Partial<ReviewSubject> | null = {}
): jest.Mocked<IFulfillmentGateway> {
  return {
    getForReview: jest
      .fn()
      .mockResolvedValue(subject === null ? null : reviewSubject(subject)),
  } as jest.Mocked<IFulfillmentGateway>;
}

export function reviewSubject(overrides: Partial<ReviewSubject> = {}): ReviewSubject {
  return {
    fulfillmentId: 'ful-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    deliveredAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function makeNotificationRepo(
  overrides: Partial<INotificationRepository> = {}
): jest.Mocked<INotificationRepository> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findByDedupeKey: jest.fn().mockResolvedValue(null),
    findByRecipient: jest.fn().mockResolvedValue([]),
    countUnread: jest.fn().mockResolvedValue(0),
    ...overrides,
  } as jest.Mocked<INotificationRepository>;
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

export function makeTemplateRepo(
  overrides: Partial<INotificationTemplateRepository> = {}
): jest.Mocked<INotificationTemplateRepository> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findByKeyChannelLocale: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as jest.Mocked<INotificationTemplateRepository>;
}
