import { IUnitOfWork } from '../../../../application/shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../../../application/shared/outbox/IOutboxStore';
import { IEventBus } from '../../../../application/shared/events/IEventBus';
import { IReviewRepository } from '../../../../domain/engagement/repositories/IReviewRepository';
import { IReviewEligibilityRepository } from '../../../../domain/engagement/repositories/IReviewEligibilityRepository';
import { IRestaurantRatingViewRepository } from '../../../../domain/engagement/repositories/IRestaurantRatingViewRepository';
import { INotificationRepository } from '../../../../domain/engagement/repositories/INotificationRepository';
import { INotificationPreferenceRepository } from '../../../../domain/engagement/repositories/INotificationPreferenceRepository';
import { INotificationTemplateRepository } from '../../../../domain/engagement/repositories/INotificationTemplateRepository';
import { INotificationQueue } from '../../../../application/shared/queues/INotificationQueue';

export function makeUnitOfWork(): IUnitOfWork {
  return { runInTransaction: jest.fn(<T>(work: (ctx: unknown) => Promise<T>) => work({})) };
}

export function makeOutbox(): jest.Mocked<IOutboxStore> {
  return { append: jest.fn().mockResolvedValue(undefined) } as jest.Mocked<IOutboxStore>;
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
    ...overrides,
  } as jest.Mocked<IReviewRepository>;
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

export function makeRatingViewRepo(
  overrides: Partial<IRestaurantRatingViewRepository> = {}
): jest.Mocked<IRestaurantRatingViewRepository> {
  return {
    findByRestaurantId: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<IRestaurantRatingViewRepository>;
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

export function makeNotificationQueue(
  overrides: Partial<INotificationQueue> = {}
): jest.Mocked<INotificationQueue> {
  return {
    enqueue: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<INotificationQueue>;
}
