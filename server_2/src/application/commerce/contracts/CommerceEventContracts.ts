// Commerce Phase 14 — published cross-context event payload contracts (commerce_module.md §8.1, §10).
//
// These Zod schemas describe the *serialized* shape of every Commerce-published domain event as it
// lands in the shared `outbox` collection (i.e. `JSON.parse(JSON.stringify(event))`) and is therefore
// the exact shape downstream contexts (future Ordering, future Payments) will consume off BullMQ. They
// are the published contract — frozen by contract tests so the boundary can't drift as services split.
//
// Domain stays framework-free (CLAUDE.md): the event classes live under `src/domain/commerce/events/`
// with no validation deps; these schemas live in the application layer where Zod is already allowed.
import { z } from 'zod';
import { PAYMENT_METHOD } from '../../../domain/commerce/enums/payment-method.enum';
import { FEE_TYPE } from '../../../domain/commerce/enums/fee-type.enum';

/** Canonical envelope every DomainEvent carries once serialized for the outbox. */
const eventEnvelope = z.object({
  eventId: z.string().uuid(),
  eventName: z.string().min(1),
  aggregateId: z.string().min(1),
  // `occurredOn` is a Date in-process; JSON serialization turns it into an ISO-8601 string.
  occurredOn: z.string().datetime(),
});

const moneyJSON = z.object({
  amount: z.number().int(),
  currency: z.string().min(1),
});

const feeJSON = z.object({
  type: z.enum([FEE_TYPE.PLATFORM, FEE_TYPE.PACKAGING, FEE_TYPE.DELIVERY]),
  amount: moneyJSON,
});

const paymentMethod = z.enum([
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.UPI,
  PAYMENT_METHOD.WALLET,
  PAYMENT_METHOD.COD,
]);

const selectedOption = z.object({
  optionId: z.string().min(1),
  label: z.string(),
  priceDelta: moneyJSON,
});

const orderRequestedLine = z.object({
  menuItemId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  selectedOptions: z.array(selectedOption),
  lineTotal: moneyJSON,
});

const orderRequestedPricing = z.object({
  subtotal: moneyJSON,
  fees: z.array(feeJSON),
  discount: moneyJSON,
  tax: moneyJSON,
  total: moneyJSON,
});

const orderRequestedAddress = z.object({
  // `label` is optional on the Address VO; absent → dropped by JSON serialization.
  label: z.string().optional(),
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  pinCode: z.string().min(1),
  coordinates: z.object({ lat: z.number(), lng: z.number() }),
});

// ── OrderRequested (→ future Ordering) ───────────────────────────────────────
export const OrderRequestedSchema = eventEnvelope.extend({
  eventName: z.literal('OrderRequested'),
  customerId: z.string().min(1),
  restaurantId: z.string().min(1),
  lines: z.array(orderRequestedLine).min(1),
  pricing: orderRequestedPricing,
  deliveryAddress: orderRequestedAddress,
  paymentIntent: z.object({ method: paymentMethod }),
  idempotencyKey: z.string().min(1),
  schemaVersion: z.number().int().positive(),
});

// ── CheckoutReadyForPayment (→ future Payments) ──────────────────────────────
export const CheckoutReadyForPaymentSchema = eventEnvelope.extend({
  eventName: z.literal('CheckoutReadyForPayment'),
  customerId: z.string().min(1),
  amount: moneyJSON,
  paymentMethod,
});

/**
 * Registry of every published commerce event → its payload schema. The single source of
 * truth the contract tests iterate over and downstream consumers can import to validate jobs.
 */
export const COMMERCE_EVENT_SCHEMAS = {
  OrderRequested: OrderRequestedSchema,
  CheckoutReadyForPayment: CheckoutReadyForPaymentSchema,
} as const;

export type CommerceEventName = keyof typeof COMMERCE_EVENT_SCHEMAS;

/** Names of all events commerce publishes — handy for routing/registry wiring. */
export const COMMERCE_EVENT_NAMES = Object.keys(COMMERCE_EVENT_SCHEMAS) as CommerceEventName[];

/** True when `eventName` is a commerce-published event we hold a contract for. */
export function isCommerceEvent(eventName: string): eventName is CommerceEventName {
  return Object.prototype.hasOwnProperty.call(COMMERCE_EVENT_SCHEMAS, eventName);
}

/**
 * Validate an (already-serialized) event payload against its contract.
 * Throws ZodError on mismatch — used by contract tests and may be used by consumers as a guard.
 */
export function assertCommerceEventContract(eventName: CommerceEventName, payload: unknown): void {
  COMMERCE_EVENT_SCHEMAS[eventName].parse(payload);
}
