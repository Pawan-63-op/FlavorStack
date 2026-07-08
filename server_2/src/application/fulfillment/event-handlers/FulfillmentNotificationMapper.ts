import { DomainEvent } from '../../../domain/shared/DomainEvent';

export type RecipientRole = 'customer' | 'rider';

export interface NotificationRecipient {
  role: RecipientRole;
  id: string;
}

export interface FulfillmentNotification {
  recipients: NotificationRecipient[];
  title: string;
  body: string;
  data: Record<string, string>;
}

/**
 * Customer/rider-facing events that produce push notifications (§5.3). Internal-only events
 * (`RiderOffered`, `RiderAssignmentExpired`) and timeouts are intentionally absent — they drive the
 * retry/re-offer flow, not notifications.
 */
export const FULFILLMENT_NOTIFICATION_EVENTS: readonly string[] = [
  'FulfillmentCreated',
  'ReadyForPickup',
  'RiderAssigned',
  'OutForDelivery',
  'DeliveryCompleted',
  'FulfillmentCancelled',
  'DeliveryFailed',
];

/** Per-event push copy. `body` may read the event for a reason/detail line. */
const COPY: Record<string, { title: string; body: (event: Record<string, unknown>) => string }> = {
  FulfillmentCreated: {
    title: 'Order confirmed',
    body: () => 'We received your order and sent it to the restaurant.',
  },
  ReadyForPickup: {
    title: 'Order ready',
    body: () => 'Your order is ready and waiting for a rider.',
  },
  RiderAssigned: {
    title: 'Rider assigned',
    body: () => 'A rider is on the way to pick up your order.',
  },
  OutForDelivery: {
    title: 'Out for delivery',
    body: () => 'Your order is out for delivery.',
  },
  DeliveryCompleted: {
    title: 'Delivered',
    body: () => 'Your order has been delivered. Enjoy your meal!',
  },
  FulfillmentCancelled: {
    title: 'Order cancelled',
    body: (event) =>
      typeof event.reason === 'string' && event.reason
        ? `Your order was cancelled: ${event.reason}.`
        : 'Your order was cancelled.',
  },
  DeliveryFailed: {
    title: 'Delivery issue',
    body: () => 'We hit a problem delivering your order. Support will follow up.',
  },
};

/** Collect whichever recipient ids the event itself carries (no external lookup). */
function resolveRecipients(event: Record<string, unknown>): NotificationRecipient[] {
  const recipients: NotificationRecipient[] = [];
  if (typeof event.customerId === 'string' && event.customerId) {
    recipients.push({ role: 'customer', id: event.customerId });
  }
  if (typeof event.riderId === 'string' && event.riderId) {
    recipients.push({ role: 'rider', id: event.riderId });
  }
  return recipients;
}

/**
 * Map a fulfillment event to its notification template, or `null` when the event is not in scope
 * (internal/unmapped) or carries no resolvable recipient.
 */
export function mapFulfillmentEventToNotification(event: DomainEvent): FulfillmentNotification | null {
  const copy = COPY[event.eventName];
  if (!copy) return null;

  const asRecord = event as unknown as Record<string, unknown>;
  const recipients = resolveRecipients(asRecord);
  if (recipients.length === 0) return null;

  return {
    recipients,
    title: copy.title,
    body: copy.body(asRecord),
    data: { fulfillmentId: event.aggregateId, event: event.eventName },
  };
}
