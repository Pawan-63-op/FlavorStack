import { MongoFulfillmentQueryRepository } from '../../../infrastructure/repositories/FulfillmentQueryRepository';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { GetAdminDashboard } from '../../../application/fulfillment/use-cases/GetAdminDashboard';
import { RIDER_ASSIGNMENT_STATUS } from '../../../domain/fulfillment/enums/rider-assignment-status.enum';

/**
 * Phase 3 / Batch 4 — `/admin/fulfillments` is served from the `fulfillments` aggregate
 * instead of `admin_dashboard_views`.
 *
 * Three response fields no longer exist in storage and are derived on read; those are the
 * ones worth pinning, because a projection copied them and the aggregate does not have
 * them at all:
 *   riderId       — only for an ACCEPTED assignment, `null` for a bare OFFERED one
 *   exceptionFlag — fulfillmentStatus ∈ {CANCELLED, FAILED}
 *   slaBreached   — always false; a `slaBreached: true` filter returns []
 */

const R1 = 'ad-rest-1';
const R2 = 'ad-rest-2';
const RIDER = 'ad-rider-1';

interface Seed {
  id: string;
  restaurantId: string;
  status: string;
  createdAt: string;
  assignmentStatus?: string;
  cancellation?: { cancelledBy: string; reason: string; at: Date } | null;
  failureReason?: string | null;
}

function seedDoc(s: Seed): Record<string, unknown> {
  return {
    _id: s.id,
    orderRequestId: `or-${s.id}`,
    customerId: 'ad-cust-1',
    restaurantId: s.restaurantId,
    lines: [],
    deliveryAddress: {
      street: 's',
      city: 'c',
      state: 'st',
      pinCode: '1',
      coordinates: { lat: 0, lng: 0 },
    },
    pricingTotal: { amount: 12345, currency: 'INR' },
    fulfillmentStatus: s.status,
    deliveryStatus: 'UNASSIGNED',
    currentAssignment: s.assignmentStatus
      ? {
          id: `a-${s.id}`,
          riderId: RIDER,
          status: s.assignmentStatus,
          attempt: 1,
          offeredAt: new Date(s.createdAt),
          expiresAt: new Date(s.createdAt),
        }
      : null,
    assignmentHistory: [],
    cancellation: s.cancellation ?? null,
    failureReason: s.failureReason ?? null,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.createdAt),
    version: 0,
  };
}

const CANCELLED_AT = new Date('2026-06-24T09:00:00Z');

const SEED: Seed[] = [
  { id: 'a1', restaurantId: R1, status: 'CREATED', createdAt: '2026-06-21T08:00:00Z' },
  {
    id: 'a2',
    restaurantId: R1,
    status: 'READY_FOR_PICKUP',
    createdAt: '2026-06-22T08:00:00Z',
    assignmentStatus: RIDER_ASSIGNMENT_STATUS.OFFERED,
  },
  {
    id: 'a3',
    restaurantId: R2,
    status: 'OUT_FOR_DELIVERY',
    createdAt: '2026-06-23T08:00:00Z',
    assignmentStatus: RIDER_ASSIGNMENT_STATUS.ACCEPTED,
  },
  {
    id: 'a4',
    restaurantId: R1,
    status: 'CANCELLED',
    createdAt: '2026-06-24T08:00:00Z',
    cancellation: { cancelledBy: 'CUSTOMER', reason: 'changed mind', at: CANCELLED_AT },
  },
  {
    id: 'a5',
    restaurantId: R2,
    status: 'FAILED',
    createdAt: '2026-06-25T08:00:00Z',
    failureReason: 'CUSTOMER_UNAVAILABLE',
  },
];

describe('MongoFulfillmentQueryRepository.findAdminDashboard (Phase 3 / Batch 4)', () => {
  const repo = new MongoFulfillmentQueryRepository();
  const uc = new GetAdminDashboard(repo);

  beforeAll(async () => {
    await FulfillmentModel.deleteMany({});
    await FulfillmentModel.insertMany(SEED.map(seedDoc));
  });

  afterAll(async () => {
    await FulfillmentModel.deleteMany({});
  });

  const byId = async (query: Parameters<typeof uc.execute>[0] = {}): Promise<string[]> => {
    const result = await uc.execute(query);
    expect(result.isSuccess).toBe(true);
    return result.getValue().map((r) => r.fulfillmentId);
  };

  it('returns every fulfillment, newest first', async () => {
    expect(await byId()).toEqual(['a5', 'a4', 'a3', 'a2', 'a1']);
  });

  it('populates riderId only for an ACCEPTED assignment', async () => {
    const rows = (await uc.execute({})).getValue();
    const row = (id: string): (typeof rows)[number] => rows.find((r) => r.fulfillmentId === id)!;

    expect(row('a3').riderId).toBe(RIDER); // ACCEPTED
    expect(row('a2').riderId).toBeNull(); // OFFERED — no rider committed yet
    expect(row('a1').riderId).toBeNull(); // no assignment at all
  });

  it('derives exceptionFlag from CANCELLED / FAILED', async () => {
    const rows = (await uc.execute({})).getValue();
    const flagged = rows.filter((r) => r.exceptionFlag).map((r) => r.fulfillmentId);
    expect(flagged.sort()).toEqual(['a4', 'a5']);
  });

  it('carries cancellation and failureReason through unchanged', async () => {
    const rows = (await uc.execute({})).getValue();
    expect(rows.find((r) => r.fulfillmentId === 'a4')!.cancellation).toEqual({
      cancelledBy: 'CUSTOMER',
      reason: 'changed mind',
      at: CANCELLED_AT.toISOString(),
    });
    expect(rows.find((r) => r.fulfillmentId === 'a5')!.failureReason).toBe('CUSTOMER_UNAVAILABLE');
    expect(rows.find((r) => r.fulfillmentId === 'a1')!.cancellation).toBeNull();
    expect(rows.find((r) => r.fulfillmentId === 'a1')!.failureReason).toBeNull();
  });

  it('filters by status', async () => {
    expect(await byId({ status: 'CANCELLED' })).toEqual(['a4']);
    expect(await byId({ status: 'NOT_A_STATUS' })).toEqual([]);
  });

  it('filters by restaurantId', async () => {
    expect(await byId({ restaurantId: R1 })).toEqual(['a4', 'a2', 'a1']);
    expect(await byId({ restaurantId: 'does-not-exist' })).toEqual([]);
  });

  it('combines status and restaurantId filters', async () => {
    expect(await byId({ status: 'CREATED', restaurantId: R1 })).toEqual(['a1']);
    expect(await byId({ status: 'CREATED', restaurantId: R2 })).toEqual([]);
  });

  it('applies limit and offset over the newest-first ordering', async () => {
    expect(await byId({ limit: 2 })).toEqual(['a5', 'a4']);
    expect(await byId({ limit: 2, offset: 2 })).toEqual(['a3', 'a2']);
    expect(await byId({ limit: 2, offset: 10 })).toEqual([]);
  });

  it('reports slaBreached as false on every row, and returns nothing when filtering for true', async () => {
    const rows = (await uc.execute({})).getValue();
    expect(rows.every((r) => r.slaBreached === false)).toBe(true);

    // Unimplemented field: the retired projection never set it true either.
    expect(await byId({ slaBreached: true })).toEqual([]);
    // `false` must not narrow anything.
    expect(await byId({ slaBreached: false })).toEqual(['a5', 'a4', 'a3', 'a2', 'a1']);
  });
});
