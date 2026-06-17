// End-to-end integration test for the realtime `/tracking` namespace (Phase 7).
//
// Boots a real Socket.IO server + real socket.io-client over an ephemeral HTTP port (no Redis
// adapter needed for single-instance fan-out). The token service + use cases are stubbed so the
// test isolates the realtime wiring: handshake JWT auth, ownership-checked room join, rider GPS
// push, and room broadcast delivery (the DoD: "customer in a room receives location + status").
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

import { registerTrackingNamespace } from '../../../infrastructure/realtime/namespaces/tracking';
import { SocketTrackingBroadcaster } from '../../../infrastructure/realtime/SocketTrackingBroadcaster';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import { Result } from '../../../domain/shared/Result';
import { TokenPayLoad } from '../../../domain/identity/value-objects/TokenPayLoad.vo';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { RecordRiderLocation } from '../../../application/fulfillment/use-cases/RecordRiderLocation';
import { GetLiveTracking } from '../../../application/fulfillment/use-cases/GetLiveTracking';

const FULFILLMENT_ID = 'ful-1';

// Stub token service: maps opaque tokens to roles.
const tokenService: ITokenService = {
  generateAccessToken: () => '',
  generateRefreshToken: () => '',
  decode: () => null,
  verify: (token: string): Result<TokenPayLoad> => {
    const base = { sessionId: 's', jti: 'j', tokenVersion: 1, iat: 0, exp: 0 };
    if (token === 'customer-token') return Result.ok({ userId: 'cust-1', role: USER_ROLE.CUSTOMER, ...base });
    if (token === 'rider-token') return Result.ok({ userId: 'rider-1', role: USER_ROLE.DRIVER, ...base });
    return Result.fail(new ForbiddenError('invalid'));
  },
};

function waitFor<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, (data: T) => resolve(data)));
}

describe('tracking namespace (Phase 7)', () => {
  let httpServer: HttpServer;
  let io: Server;
  let broadcaster: SocketTrackingBroadcaster;
  let url: string;
  let recordRiderLocation: jest.Mocked<Pick<RecordRiderLocation, 'execute'>>;
  let getLiveTracking: jest.Mocked<Pick<GetLiveTracking, 'execute'>>;
  const clients: ClientSocket[] = [];

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    broadcaster = new SocketTrackingBroadcaster();

    recordRiderLocation = { execute: jest.fn() } as typeof recordRiderLocation;
    getLiveTracking = { execute: jest.fn() } as typeof getLiveTracking;

    const ns = io.of('/tracking');
    registerTrackingNamespace(ns, {
      tokenService,
      recordRiderLocation: recordRiderLocation as unknown as RecordRiderLocation,
      getLiveTracking: getLiveTracking as unknown as GetLiveTracking,
    });
    broadcaster.attach(ns);

    httpServer.listen(() => {
      const port = (httpServer.address() as AddressInfo).port;
      url = `http://localhost:${port}/tracking`;
      done();
    });
  });

  afterAll(async () => {
    for (const c of clients) c.disconnect();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    httpServer.close();
  });

  beforeEach(() => {
    recordRiderLocation.execute.mockReset();
    getLiveTracking.execute.mockReset();
  });

  function connect(token: string | undefined): ClientSocket {
    const c = ioClient(url, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true });
    clients.push(c);
    return c;
  }

  it('rejects a handshake without a valid token', async () => {
    const c = connect('garbage');
    const err = await waitFor<Error>(c, 'connect_error');
    expect(err.message).toBe('unauthorized');
  });

  it('lets an owning customer subscribe and then receive a broadcast location', async () => {
    getLiveTracking.execute.mockResolvedValue(
      Result.ok({ fulfillmentId: FULFILLMENT_ID, currentStatus: 'OUT_FOR_DELIVERY' } as never)
    );

    const customer = connect('customer-token');
    await waitFor(customer, 'connect');

    customer.emit('subscribe', { fulfillmentId: FULFILLMENT_ID });
    const subscribed = await waitFor<{ fulfillmentId: string }>(customer, 'tracking:subscribed');
    expect(subscribed.fulfillmentId).toBe(FULFILLMENT_ID);
    expect(getLiveTracking.execute).toHaveBeenCalledWith({ fulfillmentId: FULFILLMENT_ID, customerId: 'cust-1' });

    // A server-side broadcast (as RecordRiderLocation would issue) reaches the room member.
    const locationPromise = waitFor<{ lat: number; lng: number }>(customer, 'tracking:location');
    broadcaster.broadcastLocation(FULFILLMENT_ID, {
      fulfillmentId: FULFILLMENT_ID,
      riderId: 'rider-1',
      lat: 12.34,
      lng: 56.78,
      recordedAt: new Date().toISOString(),
    });
    const loc = await locationPromise;
    expect(loc).toMatchObject({ lat: 12.34, lng: 56.78 });
  });

  it('rejects a customer subscribe for an order they do not own', async () => {
    getLiveTracking.execute.mockResolvedValue(Result.fail(new ForbiddenError('Access denied')) as never);

    const customer = connect('customer-token');
    await waitFor(customer, 'connect');

    customer.emit('subscribe', { fulfillmentId: 'someone-elses' });
    const err = await waitFor<{ error: string }>(customer, 'tracking:error');
    expect(err.error).toBe('Access denied');
  });

  it('accepts a rider location push and acks ok', async () => {
    recordRiderLocation.execute.mockResolvedValue(Result.ok({ recordedAt: 'now', persisted: true }));

    const rider = connect('rider-token');
    await waitFor(rider, 'connect');

    const ack = await new Promise<{ ok: boolean }>((resolve) => {
      rider.emit('location', { fulfillmentId: FULFILLMENT_ID, lat: 1, lng: 2 }, resolve);
    });

    expect(ack.ok).toBe(true);
    expect(recordRiderLocation.execute).toHaveBeenCalledWith({
      fulfillmentId: FULFILLMENT_ID,
      riderId: 'rider-1',
      lat: 1,
      lng: 2,
    });
  });

  it('forbids a customer from pushing location', async () => {
    const customer = connect('customer-token');
    await waitFor(customer, 'connect');

    const ack = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      customer.emit('location', { fulfillmentId: FULFILLMENT_ID, lat: 1, lng: 2 }, resolve);
    });

    expect(ack.ok).toBe(false);
    expect(recordRiderLocation.execute).not.toHaveBeenCalled();
  });
});
