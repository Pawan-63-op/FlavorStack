import type { Connection } from 'mongoose';

import { assertRequiredConfig, assertWorkerConfig, getOutboxConfig } from '../config';
import { connectDB, disconnectDB } from '../infrastructure/database/connection';
import { RedisClient } from '../infrastructure/redis/client';
import { CacheStore } from '../infrastructure/redis/CacheStore';
import { FulfillmentCache } from '../infrastructure/redis/fulfillment/FulfillmentCache';
import { getFulfillmentConfig } from '../config/fulfillment';
import { OutboxProcessor } from '../infrastructure/outbox/OutboxProcessor';
import { OutboxDispatcher } from '../application/shared/outbox/OutboxDispatcher';

import { createIdentityContainer, IdentityContainer } from './identity.container';
import { createAuthContainer, AuthContainer } from './auth.container';
import { createEventContainer, wireIdentityEventHandlers, EventContainer } from './event.container';
import { createCatalogReadContainer, CatalogReadContainer } from './catalog.container';
import { createCatalogWriteContainer, CatalogWriteContainer } from './catalog-write.container';
import { createCommerceContainer, CommerceContainer } from './commerce.container';
import { createFulfillmentContainer, FulfillmentContainer } from './fulfillment.container';
import { CatalogRestaurantDirectory } from '../infrastructure/services/CatalogRestaurantDirectory';
import { MongoRestaurantRepository } from '../infrastructure/repositories/RestaurantRepository';
import { createAvailableDriversProvider } from '../infrastructure/services/AvailableDriversProvider';
import { createEngagementContainer, EngagementContainer } from './engagement.container';
import { runSeeds } from '../infrastructure/database/seeds';
import { ConflictError } from '../domain/shared/errors/ConflictError';
import { logger } from '../infrastructure/observability/logger';
import { TransactionContext } from '../infrastructure/database/TransactionContext';
import { IEmailQueue } from '../application/shared/queues/IEmailQueue';
import { EmailQueue } from '../infrastructure/workers/email/EmailQueue';
import { TemplateEmailComposer } from '../infrastructure/services/TemplateEmailComposer';
import { getEmailConfig } from '../config/email';
import { IFulfillmentJobScheduler } from '../application/fulfillment/jobs/FulfillmentJob';
import { FulfillmentJobQueue } from '../infrastructure/workers/fulfillment/FulfillmentJobQueue';
import { getRealtimeConfig } from '../config/realtime';
import { RedisLiveLocationStore } from '../infrastructure/realtime/RedisLiveLocationStore';
import { MongoDeliveryTrackingStore } from '../infrastructure/repositories/DeliveryTrackingStore';
import { SocketTrackingBroadcaster } from '../infrastructure/realtime/SocketTrackingBroadcaster';

import { RegisterCustomer } from '../application/identity/use-cases/RegisterCustomer';
import { RegisterDriver } from '../application/identity/use-cases/RegisterDriver';
import { RegisterUser } from '../application/identity/use-cases/RegisterUser';
import { Login } from '../application/identity/use-cases/Login';
import { RefreshToken } from '../application/identity/use-cases/RefreshToken';
import { Logout } from '../application/identity/use-cases/Logout';
import { LogoutAllSessions } from '../application/identity/use-cases/LogoutAllSessions';
import { GetActiveSessions } from '../application/identity/use-cases/GetActiveSessions';
import { VerifyEmail } from '../application/identity/use-cases/VerifyEmail';
import { ForgotPassword } from '../application/identity/use-cases/ForgotPassword';
import { ResetPassword } from '../application/identity/use-cases/ResetPassword';
import { ChangePassword } from '../application/identity/use-cases/ChangePassword';
import { SendEmailOtp } from '../application/identity/use-cases/SendEmailOtp';
import { VerifyEmailOtp } from '../application/identity/use-cases/VerifyEmailOtp';
import { SendPhoneOtp } from '../application/identity/use-cases/SendPhoneOtp';
import { VerifyPhoneOtp } from '../application/identity/use-cases/VerifyPhoneOtp';
import { AssignRole } from '../application/identity/use-cases/AssignRole';
import { GrantPermission } from '../application/identity/use-cases/GrantPermission';
import { BanUser } from '../application/identity/use-cases/BanUser';
import { UnbanUser } from '../application/identity/use-cases/UnbanUser';
import { SetDriverAvailability } from '../application/identity/use-cases/SetDriverAvailability';
import { VerifyDriver } from '../application/identity/use-cases/VerifyDriver';
import { ListDrivers } from '../application/identity/use-cases/ListDrivers';
import { ListUsers } from '../application/identity/use-cases/ListUsers';
import { GetProfile } from '../application/identity/use-cases/GetProfile';
import { UpdateProfile } from '../application/identity/use-cases/UpdateProfile';
import { ListCustomerAddresses } from '../application/identity/use-cases/ListCustomerAddresses';
import { AddCustomerAddress } from '../application/identity/use-cases/AddCustomerAddress';
import { UpdateCustomerAddress } from '../application/identity/use-cases/UpdateCustomerAddress';
import { DeleteCustomerAddress } from '../application/identity/use-cases/DeleteCustomerAddress';
import { SetDefaultCustomerAddress } from '../application/identity/use-cases/SetDefaultCustomerAddress';

export interface IdentityUseCases {
  registerCustomer: RegisterCustomer;
  registerDriver: RegisterDriver;
  registerUser: RegisterUser;
  login: Login;
  refreshToken: RefreshToken;
  logout: Logout;
  logoutAllSessions: LogoutAllSessions;
  getActiveSessions: GetActiveSessions;
  verifyEmail: VerifyEmail;
  forgotPassword: ForgotPassword;
  resetPassword: ResetPassword;
  changePassword: ChangePassword;
  sendEmailOtp: SendEmailOtp;
  verifyEmailOtp: VerifyEmailOtp;
  sendPhoneOtp: SendPhoneOtp;
  verifyPhoneOtp: VerifyPhoneOtp;
  assignRole: AssignRole;
  grantPermission: GrantPermission;
  banUser: BanUser;
  unbanUser: UnbanUser;
  getProfile: GetProfile;
  updateProfile: UpdateProfile;
  setDriverAvailability: SetDriverAvailability;
  verifyDriver: VerifyDriver;
  listDrivers: ListDrivers;
  listUsers: ListUsers;
  listCustomerAddresses: ListCustomerAddresses;
  addCustomerAddress: AddCustomerAddress;
  updateCustomerAddress: UpdateCustomerAddress;
  deleteCustomerAddress: DeleteCustomerAddress;
  setDefaultCustomerAddress: SetDefaultCustomerAddress;
}

export interface BootstrapOptions {
  /**
   * Whether `bootstrap()` should start the `OutboxProcessor` poller. Defaults to `true`
   * (backward-compatible). The API process (`server.ts`) passes `false` — `OutboxWorker`
   * (Phase 11, Batch 4) owns `outboxProcessor.start()` so only one poller ever runs.
   */
  startOutboxProcessor?: boolean;
}

/**
 * Which process is being built. The profile gates the api-only tail of `bootstrap()` —
 * `runSeeds`, the auth/catalog/commerce slices, the email queue and the 31 identity use
 * cases — while every process shares the same core wiring below.
 */
export type BootstrapProfile = 'api' | 'relay' | 'jobs';

/**
 * Everything a background process needs: Mongo, Redis, the event bus, and the two contexts
 * that react to `FulfillmentCreated` on the worker's own bus.
 *
 * Since Phase 7.3 `CreateFulfillment` runs *inside the relay*, so its post-commit
 * `publishAll([FulfillmentCreated])` fans out on the relay's bus to the fulfillment projector
 * (writes `customer_tracking_views`) and the engagement `OnFulfillmentCreated` notifier (writes
 * the `order_confirmed` INBOX row). Both are wired through **optional** constructor parameters
 * of `createFulfillmentContainer` / `createEngagementContainer`, so dropping one is a silent
 * runtime regression rather than a compile error — `worker-event-subscriptions.test.ts` guards it.
 */
export interface WorkerContainer {
  connection: Connection;
  redisClient: RedisClient;
  /** outboxRepository + driverRepository — the only identity pieces a worker touches. */
  identity: IdentityContainer;
  event: EventContainer;
  fulfillment: FulfillmentContainer;
  engagement: EngagementContainer;
  outboxProcessor: OutboxProcessor;
  fulfillmentJobScheduler: IFulfillmentJobScheduler;
  /** Phase 7 — late-bound realtime broadcaster; `server.ts` attaches the Socket.IO namespace. */
  trackingBroadcaster: SocketTrackingBroadcaster;
}

export interface AppContainer extends WorkerContainer {
  auth: AuthContainer;
  catalogRead: CatalogReadContainer;
  catalogWrite: CatalogWriteContainer;
  commerce: CommerceContainer;
  emailQueue: IEmailQueue;
  useCases: IdentityUseCases;
}

/**
 * The shared prefix of every process's composition root: Mongo, Redis, the event bus, the
 * fulfillment + engagement contexts and the outbox relay pair (constructed, not started).
 *
 * Deliberately **identical for all three profiles** — every optional parameter passed to
 * `createFulfillmentContainer` / `createEngagementContainer` here is what keeps the projector
 * and the inbox notifier subscribed inside the relay, where `CreateFulfillment` now runs.
 * If a step after the DB connects throws, the DB connection is closed before the error is
 * re-thrown so nothing is left dangling.
 */
async function buildWorkerCore(profile: BootstrapProfile): Promise<WorkerContainer> {
  if (profile === 'api') {
    assertRequiredConfig();
  } else {
    // Workers never mint or verify tokens, so the JWT key pair `assertRequiredConfig()`
    // demands would be an over-assert; they need storage only.
    assertWorkerConfig();
  }

  const connection = await connectDB();

  try {
    const redisClient = new RedisClient();
    await redisClient.connect();

    const identity = createIdentityContainer(connection);

    const event = createEventContainer();

    const fulfillmentJobScheduler = new FulfillmentJobQueue();

    const { trackingLatestTtlSeconds } = getRealtimeConfig();
    const trackingBroadcaster = new SocketTrackingBroadcaster();
    const { trackingCacheTtlSeconds, dashboardCacheTtlSeconds } = getFulfillmentConfig();
    const fulfillmentCache = new FulfillmentCache(new CacheStore(redisClient), {
      trackingSeconds: trackingCacheTtlSeconds,
      dashboardSeconds: dashboardCacheTtlSeconds,
    });
    const restaurantDirectory = new CatalogRestaurantDirectory(new MongoRestaurantRepository(new TransactionContext()));
    const availableRidersProvider = createAvailableDriversProvider(identity.driverRepository);

    const fulfillment = createFulfillmentContainer(
      connection,
      event.eventBus,
      fulfillmentJobScheduler,
      {
        liveLocationStore: new RedisLiveLocationStore(redisClient, trackingLatestTtlSeconds),
        deliveryTrackingStore: new MongoDeliveryTrackingStore(),
        broadcaster: trackingBroadcaster,
      },
      fulfillmentCache,
      restaurantDirectory,
      availableRidersProvider
    );

    // Built after Fulfillment so Engagement can read the fulfillment aggregate through a
    // gateway over its query repository, rather than keeping a `review_eligibility` copy.
    const engagement = createEngagementContainer(
      connection,
      event.eventBus,
      fulfillment.queryRepository
    );

    // The relay delivers to handlers directly instead of republishing on the
    // in-process bus — every use case already publishes its own events post-commit,
    // so a republish was pure duplication. Unrouted names settle as no-ops.
    const outboxDispatcher = new OutboxDispatcher({
      OrderRequested: (e) => fulfillment.onOrderRequested.handle(e),
    });
    const outboxProcessor = new OutboxProcessor(
      identity.outboxRepository,
      outboxDispatcher,
      getOutboxConfig(),
    );

    return {
      connection,
      redisClient,
      identity,
      event,
      fulfillment,
      engagement,
      outboxProcessor,
      fulfillmentJobScheduler,
      trackingBroadcaster,
    };
  } catch (err) {
    await disconnectDB();
    throw err;
  }
}

/**
 * Build the composition root for a background process: `buildWorkerCore` and nothing else.
 *
 * Explicitly **no `runSeeds`**. The api process seeds on every boot and is always present, so
 * a worker seeding as well only ever races it — the `ConflictError`-downgrade in `bootstrap()`
 * below exists solely because three processes used to contend for `notification_templates`.
 */
export async function bootstrapWorker(profile: 'relay' | 'jobs'): Promise<WorkerContainer> {
  return buildWorkerCore(profile);
}

/**
 * Build and start the full Identity application graph. Resolves to a fully-populated
 * `AppContainer` (every one of the 20 `useCases.*` is a constructed instance) given
 * valid env vars and reachable Mongo + Redis. If a step after the DB connects throws,
 * the DB connection is closed before the error is re-thrown so nothing is left dangling.
 */
export async function bootstrap(opts: BootstrapOptions = {}): Promise<AppContainer> {
  const startOutboxProcessor = opts.startOutboxProcessor ?? true;

  const core = await buildWorkerCore('api');
  const { connection, redisClient, identity, event, engagement, outboxProcessor } = core;

  try {
    const auth = createAuthContainer(redisClient);

    const catalogRead = createCatalogReadContainer(event.eventBus, new TransactionContext());
    const catalogWrite = createCatalogWriteContainer(connection, event.eventBus);

    const commerce = createCommerceContainer(connection, event.eventBus, {
      readRepository: catalogRead.readRepository,
      serviceabilityQuery: catalogRead.queries.checkServiceability,
      openingHoursService: catalogRead.openingHoursService,
      queryRepository: catalogRead.queryRepository,
    });

    try {
      const { notificationTemplatesCreated } = await runSeeds({
        notificationTemplateRepo: engagement.templateRepository,
      });
      logger.info({ notificationTemplatesCreated }, '[bootstrap] seeds complete');
    } catch (err) {
      if (err instanceof ConflictError) {
        logger.warn(
          { err: String(err) },
          '[bootstrap] notification templates are being seeded by a concurrent process — continuing'
        );
      } else {
        throw err;
      }
    }

    const emailQueue = new EmailQueue();
    // Identity renders its own copy from the Engagement-owned template store through a port,
    // so the email worker stays a dumb transport (Phase 5 Batch 3).
    const emailComposer = new TemplateEmailComposer(engagement.templateRepository);
    wireIdentityEventHandlers(event.eventBus, {
      emailQueue,
      emailComposer,
      userRepository: identity.userRepository,
    });

    if (startOutboxProcessor) {
      outboxProcessor.start();
    }

    const registerCustomer = new RegisterCustomer(
      identity.userRepository,
      identity.customerRepository,
      auth.passwordHasher,
      identity.unitOfWork,
      event.eventBus,
    );
    const registerDriver = new RegisterDriver(
      identity.userRepository,
      auth.passwordHasher,
      identity.unitOfWork,
      event.eventBus,
    );

    const useCases: IdentityUseCases = {
      registerCustomer,
      registerDriver,
      registerUser: new RegisterUser(registerCustomer, registerDriver),
      login: new Login(
        identity.userRepository,
        auth.passwordHasher,
        auth.tokenService,
        auth.sessionStore,
        auth.refreshTokenHasher,
      ),
      refreshToken: new RefreshToken(
        identity.userRepository,
        auth.tokenService,
        auth.sessionStore,
        auth.refreshTokenHasher,
      ),
      logout: new Logout(auth.sessionStore),
      logoutAllSessions: new LogoutAllSessions(
        identity.userRepository,
        auth.sessionStore,
        identity.unitOfWork,
        event.eventBus,
      ),
      getActiveSessions: new GetActiveSessions(auth.sessionStore),
      verifyEmail: new VerifyEmail(
        identity.userRepository,
        auth.otpStore,
        identity.unitOfWork,
        event.eventBus,
      ),
      forgotPassword: new ForgotPassword(
        identity.userRepository,
        auth.otpGenerator,
        auth.otpStore,
        identity.unitOfWork,
        event.eventBus,
        emailQueue,
        emailComposer,
        getEmailConfig().appBaseUrl,
      ),
      resetPassword: new ResetPassword(
        identity.userRepository,
        auth.otpStore,
        auth.passwordHasher,
        auth.sessionStore,
        identity.unitOfWork,
        event.eventBus,
      ),
      changePassword: new ChangePassword(
        identity.userRepository,
        auth.passwordHasher,
        auth.sessionStore,
        identity.unitOfWork,
        event.eventBus,
      ),
      sendEmailOtp: new SendEmailOtp(
        identity.userRepository,
        auth.otpGenerator,
        auth.otpStore,
        auth.emailProvider,
      ),
      verifyEmailOtp: new VerifyEmailOtp(auth.otpStore),
      sendPhoneOtp: new SendPhoneOtp(
        identity.userRepository,
        auth.otpGenerator,
        auth.otpStore,
        auth.smsProvider,
      ),
      verifyPhoneOtp: new VerifyPhoneOtp(identity.userRepository, auth.otpStore),
      assignRole: new AssignRole(
        identity.userRepository,
        identity.unitOfWork,
        event.eventBus,
      ),
      grantPermission: new GrantPermission(
        identity.userRepository,
        identity.unitOfWork,
        event.eventBus,
      ),
      banUser: new BanUser(
        identity.userRepository,
        auth.sessionStore,
        identity.unitOfWork,
        event.eventBus,
      ),
      unbanUser: new UnbanUser(
        identity.userRepository,
        identity.unitOfWork,
        event.eventBus,
      ),
      getProfile: new GetProfile(identity.userRepository),
      updateProfile: new UpdateProfile(identity.userRepository),
      listCustomerAddresses: new ListCustomerAddresses(identity.userRepository),
      addCustomerAddress: new AddCustomerAddress(identity.userRepository),
      updateCustomerAddress: new UpdateCustomerAddress(identity.userRepository),
      deleteCustomerAddress: new DeleteCustomerAddress(identity.userRepository),
      setDefaultCustomerAddress: new SetDefaultCustomerAddress(identity.userRepository),
      setDriverAvailability: new SetDriverAvailability(identity.userRepository),
      verifyDriver: new VerifyDriver(
        identity.userRepository,
        identity.unitOfWork,
        event.eventBus,
      ),
      listDrivers: new ListDrivers(identity.driverRepository),
      listUsers: new ListUsers(identity.userRepository),
    };

    return {
      ...core,
      auth,
      catalogRead,
      catalogWrite,
      commerce,
      emailQueue,
      useCases,
    };
  } catch (err) {
    await disconnectDB();
    throw err;
  }
}

/**
 * Graceful teardown in reverse order of bootstrap: stop the outbox poller (drains the
 * in-flight batch), close the email + fulfillment queues, close Redis, then disconnect Mongo.
 * The email queue is api-only, so it is closed only when the container actually owns one.
 */
export async function shutdown(app: WorkerContainer): Promise<void> {
  await app.outboxProcessor.stop();
  if ('emailQueue' in app) {
    await (app as AppContainer).emailQueue.close();
  }
  await app.fulfillmentJobScheduler.close();
  await app.redisClient.shutdown();
  await disconnectDB();
}
