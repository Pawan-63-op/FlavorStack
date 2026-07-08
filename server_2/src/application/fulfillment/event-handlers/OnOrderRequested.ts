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
      logger.error(
        { eventId: event.eventId, orderRequestId: dto.orderRequestId, err: String(result.getError()) },
        '[OnOrderRequested] CreateFulfillment failed'
      );
      return;
    }

    this.processedEventIds.add(event.eventId);
  }
}
