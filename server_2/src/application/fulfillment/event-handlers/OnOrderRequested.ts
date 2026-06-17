// Event handler: consumes Commerce's OrderRequested off the in-process bus and invokes CreateFulfillment
// (fulfillment_module.md §6.3, Phase 1). This is the live cross-context path today: OutboxProcessor drains
// committed outbox rows and publishes them onto the same IEventBus this handler subscribes to (QUEUE.fulfillment
// is the future service-split transport).
//
// Decoupling: Fulfillment reads only the PUBLISHED OrderRequested payload (§14.2) — a locally-declared shape,
// never a Commerce aggregate/repo. The rehydrated bus event spreads the serialized payload over the canonical
// DomainEvent fields, so `orderRequestId` is the event's aggregateId.
//
// Idempotency is layered: an in-memory eventId guard skips redelivery within a process, and CreateFulfillment's
// findByOrderRequestId + the unique index make a duplicate OrderRequested a durable no-op across restarts.
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { CreateFulfillment } from '../use-cases/CreateFulfillment';
import { CreateFulfillmentDto } from '../dtos/CreateFulfillmentDto';
import { logger } from '../../../infrastructure/observability/logger';

interface ConsumedMoney {
  amount: number;
  currency: string;
}

interface ConsumedOrderRequested extends DomainEvent {
  customerId: string;
  restaurantId: string;
  lines: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    selectedOptions: Array<{ optionId: string; label: string; priceDelta: ConsumedMoney }>;
    lineTotal: ConsumedMoney;
  }>;
  pricing: { total: ConsumedMoney };
  deliveryAddress: {
    label?: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
    coordinates: { lat: number; lng: number };
  };
}

export class OnOrderRequested {
  private readonly processedEventIds = new Set<string>();

  constructor(private readonly createFulfillment: CreateFulfillment) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;

    const e = event as ConsumedOrderRequested;
    const dto: CreateFulfillmentDto = {
      orderRequestId: e.aggregateId,
      customerId: e.customerId,
      restaurantId: e.restaurantId,
      lines: e.lines.map((line) => ({
        menuItemId: line.menuItemId,
        name: line.name,
        quantity: line.quantity,
        selectedOptions: (line.selectedOptions ?? []).map((option) => ({
          optionId: option.optionId,
          label: option.label,
          priceDelta: option.priceDelta,
        })),
        lineTotal: line.lineTotal,
      })),
      deliveryAddress: e.deliveryAddress,
      total: e.pricing.total,
    };

    const result = await this.createFulfillment.execute(dto);
    if (result.isFailure) {
      // Best-effort consumer: log and let the row be retried by the outbox processor. We do NOT mark the
      // eventId processed on failure so a retry can re-attempt.
      logger.error(
        { eventId: event.eventId, orderRequestId: dto.orderRequestId, err: String(result.getError()) },
        '[OnOrderRequested] CreateFulfillment failed'
      );
      return;
    }

    this.processedEventIds.add(event.eventId);
  }
}
