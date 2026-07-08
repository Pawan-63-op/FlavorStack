import type { Money } from "../api/format/money";

/**
 * Client-tracked order list (Batch 6.3). server_2 has no "list my orders"
 * endpoint, so checkout persists each `orderRequestId` locally; Phase 7 renders
 * history by re-fetching `GET /order-requests/:id` per stored id. Local-only,
 * never synced — clearing storage loses the list (documented limitation).
 */
export interface TrackedOrder {
  orderRequestId: string;
  restaurantName: string;
  /** Order total in major units (already converted by the checkout adapter). */
  total: Money | null;
  /** ISO timestamp from `OrderRequestSummaryResponse.createdAt`. */
  createdAt: string;
  /** The Idempotency-Key used to place the order — kept for safe retry. */
  idempotencyKey: string;
  /**
   * Known only once discovered from a tracking fetch or socket snapshot
   * (the order↔fulfillment linkage gap — see Phase_7.md). Absent until then.
   */
  fulfillmentId?: string;
  /** Most recently observed `FULFILLMENT_STATUS`, cached for list display without a live request. */
  lastKnownStatus?: string;
}

const STORAGE_KEY = "tracked-orders";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

/** All tracked orders, newest first. Returns `[]` on any read/parse failure. */
export function getTrackedOrders(): TrackedOrder[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrackedOrder[]) : [];
  } catch {
    return [];
  }
}

/**
 * Prepend an order (newest first), de-duplicating by `orderRequestId` so an
 * idempotent replay of the same logical order doesn't create a second entry.
 */
export function addTrackedOrder(order: TrackedOrder): void {
  if (!canUseStorage()) return;
  const existing = getTrackedOrders().filter(
    (o) => o.orderRequestId !== order.orderRequestId,
  );
  const next = [order, ...existing];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / serialization failure — non-fatal, history is best-effort */
  }
}

/** Look up a single tracked order by id, or `undefined` if not stored. */
export function getTrackedOrder(orderRequestId: string): TrackedOrder | undefined {
  return getTrackedOrders().find((o) => o.orderRequestId === orderRequestId);
}

/** Patch a single field on the matching tracked order in place; no-op if not tracked. */
function patchTrackedOrder(
  orderRequestId: string,
  patch: Partial<Pick<TrackedOrder, "fulfillmentId" | "lastKnownStatus">>,
): void {
  if (!canUseStorage()) return;
  const orders = getTrackedOrders();
  const index = orders.findIndex((o) => o.orderRequestId === orderRequestId);
  if (index === -1) return;
  orders[index] = { ...orders[index], ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    /* quota / serialization failure — non-fatal, history is best-effort */
  }
}

/** Cache a discovered `orderRequestId → fulfillmentId` mapping once known. */
export function setFulfillmentId(orderRequestId: string, fulfillmentId: string): void {
  patchTrackedOrder(orderRequestId, { fulfillmentId });
}

/** Cache the latest observed fulfillment status for list display without a live request. */
export function updateTrackedStatus(orderRequestId: string, status: string): void {
  patchTrackedOrder(orderRequestId, { lastKnownStatus: status });
}
