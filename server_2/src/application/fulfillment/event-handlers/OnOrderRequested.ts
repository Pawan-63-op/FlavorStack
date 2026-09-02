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
  constructor(private readonly createFulfillment: CreateFulfillment) {}

  async handle(event: DomainEvent): Promise<void> {
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
      const error = result.getError();
      // Throw, don't swallow: this handler runs in the outbox relay, so rejecting
      // is what buys the retry with backoff and, eventually, a FAILED row. A
      // logged-and-returned failure here is an order that silently never reaches
      // the restaurant. Retrying is safe — CreateFulfillment short-circuits on
      // findByOrderRequestId and the unique index closes the race.
      logger.error(
        { eventId: event.eventId, orderRequestId: dto.orderRequestId, err: String(error) },
        '[OnOrderRequested] CreateFulfillment failed'
      );
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}
