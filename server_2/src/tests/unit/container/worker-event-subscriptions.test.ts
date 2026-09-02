/**
 * The regression guard for Phase 8's single largest risk.
 *
 * Since Phase 7.3 `CreateFulfillment` runs *inside the relay*, so its post-commit
 * `publishAll([FulfillmentCreated])` fans out on the **worker's own** bus. Two of those
 * subscribers are load-bearing and are wired through *optional* constructor parameters of
 * `createFulfillmentContainer` / `createEngagementContainer` — a narrower composition root that
 * omits them still compiles, still boots, and silently produces orders with no tracking row and
 * no `order_confirmed` inbox notification.
 *
 * | Subscriber                                | Consequence if missing                          |
 * |-------------------------------------------|-------------------------------------------------|
 * | `FulfillmentProjector.onFulfillmentCreated`| `customer_tracking_views` empty → `/me/orders` blank |
 * | Engagement `OnFulfillmentCreated`          | no `order_confirmed` INBOX row                  |
 * | `TrackingStatusBridge`                     | nothing (documented worker no-op, Phase 7.3)    |
 */
import { generateKeyPairSync } from 'crypto';

jest.mock('../../../infrastructure/database/connection', () => ({
  connectDB: jest.fn(),
  disconnectDB: jest.fn(),
}));

const mockRedisInstance = {
  connect: jest.fn(),
  shutdown: jest.fn(),
  getClient: jest.fn(() => ({})),
  isReady: jest.fn(() => true),
};
jest.mock('../../../infrastructure/redis/client', () => ({
  RedisClient: jest.fn(() => mockRedisInstance),
}));

jest.mock('../../../infrastructure/database/seeds', () => ({
  runSeeds: jest.fn().mockResolvedValue({ notificationTemplatesCreated: 0 }),
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(function (this: { add: jest.Mock; close: jest.Mock }) {
    this.add = jest.fn().mockResolvedValue(undefined);
    this.close = jest.fn().mockResolvedValue(undefined);
  }),
}));

import { Queue } from 'bullmq';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { bootstrapWorker, shutdown, WorkerContainer } from '../../../container';
import { connectDB } from '../../../infrastructure/database/connection';
import { RedisClient } from '../../../infrastructure/redis/client';
import { FulfillmentProjector } from '../../../application/fulfillment/projector/FulfillmentProjector';
import { OnFulfillmentCreated } from '../../../application/engagement/event-handlers/OnFulfillmentCreated';
import { TrackingStatusBridge } from '../../../application/fulfillment/event-handlers/TrackingStatusBridge';

const mockConnectDB = connectDB as jest.MockedFunction<typeof connectDB>;

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.JWT_PRIVATE_KEY = privateKey;
  process.env.JWT_PUBLIC_KEY = publicKey;
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.BCRYPT_ROUNDS = '4';
  process.env.OUTBOX_POLL_INTERVAL_MS = '999999';
  process.env.MONGO_URI = 'mongodb://localhost:27017/test?replicaSet=rs0';

  (RedisClient as unknown as jest.Mock).mockImplementation(() => mockRedisInstance);
  (Queue as unknown as jest.Mock).mockImplementation(function (this: { add: jest.Mock; close: jest.Mock }) {
    this.add = jest.fn().mockResolvedValue(undefined);
    this.close = jest.fn().mockResolvedValue(undefined);
  });
  mockConnectDB.mockResolvedValue({} as Awaited<ReturnType<typeof connectDB>>);
  mockRedisInstance.connect.mockResolvedValue(undefined);
  mockRedisInstance.shutdown.mockResolvedValue(undefined);
  mockRedisInstance.getClient.mockReturnValue({});
  mockRedisInstance.isReady.mockReturnValue(true);
});

afterEach(() => {
  process.env = { ...originalEnv };
});

/** Reach into `InMemoryEventBus`'s private registry — the only way to see who is subscribed. */
function subscribersFor(app: WorkerContainer, eventName: string): Array<(e: DomainEvent) => Promise<void>> {
  const bus = app.event.eventBus as unknown as {
    handlers: Map<string, Array<(e: DomainEvent) => Promise<void>>>;
  };
  return bus.handlers.get(eventName) ?? [];
}

describe('worker event subscriptions', () => {
  it('keeps FulfillmentCreated fanned out to at least the projector, the engagement notifier and the bridge', async () => {
    const projectorSpy = jest.spyOn(FulfillmentProjector.prototype, 'onFulfillmentCreated').mockResolvedValue(undefined);
    const engagementSpy = jest.spyOn(OnFulfillmentCreated.prototype, 'handle').mockResolvedValue(undefined);
    const bridgeSpy = jest.spyOn(TrackingStatusBridge.prototype, 'handle').mockResolvedValue(undefined);

    const app = await bootstrapWorker('relay');

    try {
      const subscribers = subscribersFor(app, 'FulfillmentCreated');
      expect(subscribers.length).toBeGreaterThanOrEqual(3);

      // Behavioural, not structural: publish and confirm each named reaction actually ran.
      await app.event.eventBus.publish({
        eventId: 'evt-1',
        occurredOn: new Date(),
        eventName: 'FulfillmentCreated',
        aggregateId: 'ful-1',
      } as DomainEvent);

      expect(projectorSpy).toHaveBeenCalledTimes(1);
      expect(engagementSpy).toHaveBeenCalledTimes(1);
      expect(bridgeSpy).toHaveBeenCalledTimes(1);
    } finally {
      await shutdown(app);
      projectorSpy.mockRestore();
      engagementSpy.mockRestore();
      bridgeSpy.mockRestore();
    }
  });

  it('keeps the RiderOffered → assignment-timeout scheduler subscribed in the jobs profile', async () => {
    const app = await bootstrapWorker('jobs');

    try {
      // Without this the first re-offer works and the *chained* next timeout never fires.
      expect(subscribersFor(app, 'RiderOffered').length).toBeGreaterThanOrEqual(1);
      expect(subscribersFor(app, 'ReadyForPickup').length).toBeGreaterThanOrEqual(1);
    } finally {
      await shutdown(app);
    }
  });
});
