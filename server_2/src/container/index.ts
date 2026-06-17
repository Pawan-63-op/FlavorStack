// Composition root / application bootstrap for the Identity bounded context (Phase 11, Batch 4).
//
// This is the single place the whole Identity object graph is assembled. It owns
// connection lifecycle (Mongo, Redis, OutboxProcessor) and wires the three context
// containers (identity, auth, event) into the 20 frozen Identity use-cases.
//
// Bootstrap order (deterministic, fail-fast):
//   0. assertRequiredConfig()        — throw before any network connection on missing env
//   1. connectDB()                   — Mongo
//   2. RedisClient.connect()         — Redis
//   3. createIdentityContainer()     — repos + UoW + outbox store (shared TransactionContext)
//   4. createAuthContainer()         — token/password/session/email/otp/sms
//   5. createEventContainer()        — in-process event bus
//   6. wireIdentityEventHandlers()   — BEFORE the processor starts, so drained events have subscribers
//   7. new OutboxProcessor()         — only `.start()`s when opts.startOutboxProcessor !== false
//   8. construct all 20 use-cases    — RegisterUser after RegisterCustomer/RegisterDriver
//   9. return AppContainer
//
// NOTE: `bootstrap()` is intended to be called once per process. The API (`server.ts`) calls
// `bootstrap({ startOutboxProcessor: false })` — `OutboxWorker` (`src/workers/outbox.worker.ts`)
// owns the poller, so only one `OutboxProcessor.start()` ever runs across all processes.
// A second call would create a duplicate RedisClient/OutboxProcessor (duplicate-poller bug);
// single-call per process is enforced by the entrypoint structure, not a runtime guard here (YAGNI).
import type { Connection } from 'mongoose';

import { assertRequiredConfig, getOutboxConfig } from '../config';
import { connectDB, disconnectDB } from '../infrastructure/database/connection';
import { RedisClient } from '../infrastructure/redis/client';
import { CacheStore } from '../infrastructure/redis/CacheStore';
import { CatalogCache } from '../infrastructure/redis/catalog/CatalogCache';
import { FulfillmentCache } from '../infrastructure/redis/fulfillment/FulfillmentCache';
import { getFulfillmentConfig } from '../config/fulfillment';
import { OutboxProcessor } from '../infrastructure/outbox/OutboxProcessor';

import { createIdentityContainer, IdentityContainer } from './identity.container';
import { createAuthContainer, AuthContainer } from './auth.container';
import { createEventContainer, wireIdentityEventHandlers, EventContainer } from './event.container';
import { createCatalogReadContainer, CatalogReadContainer } from './catalog.container';
import { createCatalogWriteContainer, CatalogWriteContainer } from './catalog-write.container';
import { createCommerceContainer, CommerceContainer } from './commerce.container';
import { createFulfillmentContainer, FulfillmentContainer } from './fulfillment.container';
import { TransactionContext } from '../infrastructure/database/TransactionContext';
import { IEmailQueue } from '../application/shared/queues/IEmailQueue';
import { EmailQueue } from '../infrastructure/workers/email/EmailQueue';
import { INotificationQueue } from '../application/shared/queues/INotificationQueue';
import { NotifyQueue } from '../infrastructure/workers/notification/NotifyQueue';
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
import { GetProfile } from '../application/identity/use-cases/GetProfile';
import { UpdateProfile } from '../application/identity/use-cases/UpdateProfile';

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
}

export interface BootstrapOptions {
  /**
   * Whether `bootstrap()` should start the `OutboxProcessor` poller. Defaults to `true`
   * (backward-compatible). The API process (`server.ts`) passes `false` — `OutboxWorker`
   * (Phase 11, Batch 4) owns `outboxProcessor.start()` so only one poller ever runs.
   */
  startOutboxProcessor?: boolean;
}

export interface AppContainer {
  connection: Connection;
  redisClient: RedisClient;
  identity: IdentityContainer;
  auth: AuthContainer;
  event: EventContainer;
  catalogRead: CatalogReadContainer;
  catalogWrite: CatalogWriteContainer;
  commerce: CommerceContainer;
  fulfillment: FulfillmentContainer;
  outboxProcessor: OutboxProcessor;
  emailQueue: IEmailQueue;
  notificationQueue: INotificationQueue;
  fulfillmentJobScheduler: IFulfillmentJobScheduler;
  /** Phase 7 — late-bound realtime broadcaster; `server.ts` attaches the Socket.IO namespace. */
  trackingBroadcaster: SocketTrackingBroadcaster;
  useCases: IdentityUseCases;
}

/**
 * Build and start the full Identity application graph. Resolves to a fully-populated
 * `AppContainer` (every one of the 20 `useCases.*` is a constructed instance) given
 * valid env vars and reachable Mongo + Redis. If a step after the DB connects throws,
 * the DB connection is closed before the error is re-thrown so nothing is left dangling.
 */
export async function bootstrap(opts: BootstrapOptions = {}): Promise<AppContainer> {
  const startOutboxProcessor = opts.startOutboxProcessor ?? true;

  // 0. Fail fast on missing env (JWT keys / Resend key) before opening any connection.
  assertRequiredConfig();

  // 1. Mongo.
  const connection = await connectDB();

  try {
    // 2. Redis.
    const redisClient = new RedisClient();
    await redisClient.connect();

    // 3. Repositories + persistence ports (shared TransactionContext).
    const identity = createIdentityContainer(connection);

    // 4. Auth / crypto / session / messaging services.
    const auth = createAuthContainer(redisClient);

    // 5. In-process event bus.
    const event = createEventContainer();

    // 5b. Catalog read + write graphs. The read container subscribes its
    //     projector to `event.eventBus`, so command use-cases that publish on
    //     the same bus after commit keep the projections in sync.
    const catalogCache = new CatalogCache(new CacheStore(redisClient));
    const catalogRead = createCatalogReadContainer(
      event.eventBus,
      new TransactionContext(),
      catalogCache,
    );
    const catalogWrite = createCatalogWriteContainer(connection, event.eventBus);

    // 5c. Commerce write graph (Phase 4 cart use-cases). CartItemAdded/CartCleared
    //     publish on the same in-process bus after commit (in-process only, not outbox-routed).
    //     The Phase 10 Catalog ACL gateway is fed Catalog's three published read ports from the
    //     read container above — Commerce adapts them, never re-instantiating Catalog concretes.
    const commerce = createCommerceContainer(connection, event.eventBus, {
      readRepository: catalogRead.readRepository,
      serviceabilityQuery: catalogRead.queries.checkServiceability,
      openingHoursService: catalogRead.openingHoursService,
    });

    // 5d. Fulfillment write graph (Phase 1). Subscribes OnOrderRequested to the same in-process bus
    //     BEFORE the outbox processor starts, so Commerce's drained OrderRequested rows create exactly
    //     one Fulfillment (duplicate orderRequestId is an idempotent no-op).
    //     Phase 5B: a BullMQ delayed-job scheduler arms assignment-timeout / SLA jobs when the
    //     matching events are published on the bus (in whichever process runs the OutboxProcessor).
    const fulfillmentJobScheduler = new FulfillmentJobQueue();

    // Phase 7: realtime tracking infra (Redis latest-location + throttle gate, Mongo history,
    // late-bound Socket.IO broadcaster). The broadcaster's namespace is attached in `server.ts`
    // after the HTTP server is listening; until then status/location broadcasts are no-ops.
    const { trackingLatestTtlSeconds } = getRealtimeConfig();
    const trackingBroadcaster = new SocketTrackingBroadcaster();
    // Phase 8: notification producer. Passed into the fulfillment graph so the dispatcher can turn
    // customer/rider-facing status events into push jobs on `notification-queue`.
    const notificationQueue = new NotifyQueue();
    // Phase 9 (Batch 9.1): read-side cache for the hot tracking/dashboard queries. Shares the
    // process Redis via CacheStore; TTLs come from the single fulfillment config source.
    const { trackingCacheTtlSeconds, dashboardCacheTtlSeconds } = getFulfillmentConfig();
    const fulfillmentCache = new FulfillmentCache(new CacheStore(redisClient), {
      trackingSeconds: trackingCacheTtlSeconds,
      dashboardSeconds: dashboardCacheTtlSeconds,
    });
    const fulfillment = createFulfillmentContainer(
      connection,
      event.eventBus,
      fulfillmentJobScheduler,
      {
        liveLocationStore: new RedisLiveLocationStore(redisClient, trackingLatestTtlSeconds),
        deliveryTrackingStore: new MongoDeliveryTrackingStore(),
        broadcaster: trackingBroadcaster,
      },
      notificationQueue,
      fulfillmentCache
    );

    // 6. Subscribe identity handlers BEFORE the processor starts draining events.
    const emailQueue = new EmailQueue();
    wireIdentityEventHandlers(event.eventBus, emailQueue);

    // 7. Reliable async dispatch spine. The API process passes `startOutboxProcessor:
    //    false` — `OutboxWorker` (Phase 11) owns `.start()` so only one poller ever runs.
    const outboxProcessor = new OutboxProcessor(
      identity.outboxRepository,
      event.eventBus,
      getOutboxConfig(),
    );
    if (startOutboxProcessor) {
      outboxProcessor.start();
    }

    // 8. Construct all 20 use-cases. RegisterUser composes RegisterCustomer + RegisterDriver,
    //    so those two are built first.
    const registerCustomer = new RegisterCustomer(
      identity.userRepository,
      identity.customerRepository,
      auth.passwordHasher,
      identity.unitOfWork,
      identity.outboxStore,
      event.eventBus,
    );
    const registerDriver = new RegisterDriver(
      identity.userRepository,
      auth.passwordHasher,
      identity.unitOfWork,
      identity.outboxStore,
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
        identity.outboxStore,
        event.eventBus,
      ),
      getActiveSessions: new GetActiveSessions(auth.sessionStore),
      verifyEmail: new VerifyEmail(
        identity.userRepository,
        auth.otpStore,
        identity.unitOfWork,
        identity.outboxStore,
        event.eventBus,
      ),
      forgotPassword: new ForgotPassword(
        identity.userRepository,
        auth.otpGenerator,
        auth.otpStore,
        identity.unitOfWork,
        identity.outboxStore,
        event.eventBus,
      ),
      resetPassword: new ResetPassword(
        identity.userRepository,
        auth.otpStore,
        auth.passwordHasher,
        auth.sessionStore,
        identity.unitOfWork,
        identity.outboxStore,
        event.eventBus,
      ),
      changePassword: new ChangePassword(
        identity.userRepository,
        auth.passwordHasher,
        auth.sessionStore,
        identity.unitOfWork,
        identity.outboxStore,
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
        identity.outboxStore,
        event.eventBus,
      ),
      grantPermission: new GrantPermission(
        identity.userRepository,
        identity.unitOfWork,
        identity.outboxStore,
        event.eventBus,
      ),
      banUser: new BanUser(
        identity.userRepository,
        auth.sessionStore,
        identity.unitOfWork,
        identity.outboxStore,
        event.eventBus,
      ),
      unbanUser: new UnbanUser(
        identity.userRepository,
        identity.unitOfWork,
        identity.outboxStore,
        event.eventBus,
      ),
      getProfile: new GetProfile(identity.userRepository),
      updateProfile: new UpdateProfile(identity.userRepository),
    };

    // 9. Phase-10 placeholder: controllers (`src/api/v1/controllers/*`) are still stubs.
    //    `useCases` is returned on the AppContainer so Phase 10's app.ts can wire
    //    AuthController/UserController from `app.useCases.*` without reaching into the
    //    container internals. The absence of a "construct controllers" step here is
    //    intentional, not an oversight.
    return {
      connection,
      redisClient,
      identity,
      auth,
      event,
      catalogRead,
      catalogWrite,
      commerce,
      fulfillment,
      outboxProcessor,
      emailQueue,
      notificationQueue,
      fulfillmentJobScheduler,
      trackingBroadcaster,
      useCases,
    };
  } catch (err) {
    // Anything after the DB connected failed — close Mongo so we don't leak the
    // connection on a partial bootstrap, then re-throw the original error.
    await disconnectDB();
    throw err;
  }
}

/**
 * Graceful teardown in reverse order of bootstrap: stop the outbox poller (drains the
 * in-flight batch), close the email + notification queues, close Redis, then disconnect Mongo.
 */
export async function shutdown(app: AppContainer): Promise<void> {
  await app.outboxProcessor.stop();
  await app.emailQueue.close();
  await app.notificationQueue.close();
  await app.fulfillmentJobScheduler.close();
  await app.redisClient.shutdown();
  await disconnectDB();
}
