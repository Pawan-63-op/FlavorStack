import { OnOrderRequested } from '../../../../application/fulfillment/event-handlers/OnOrderRequested';
import { CreateFulfillment } from '../../../../application/fulfillment/use-cases/CreateFulfillment';
import { CreateFulfillmentDto } from '../../../../application/fulfillment/dtos/CreateFulfillmentDto';
import { Result } from '../../../../domain/shared/Result';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';

function orderRequestedEvent(overrides: Record<string, unknown> = {}): DomainEvent {
  return {
    eventId: 'evt-1',
    eventName: 'OrderRequested',
    occurredOn: new Date(),
    aggregateId: 'order-req-1', // orderRequestId
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    lines: [
      {
        menuItemId: 'item-1',
        name: 'Paneer Tikka',
        quantity: 2,
        selectedOptions: [{ optionId: 'opt-1', label: 'Extra spicy', priceDelta: { amount: 0, currency: 'INR' } }],
        lineTotal: { amount: 40000, currency: 'INR' },
      },
    ],
    pricing: {
      subtotal: { amount: 40000, currency: 'INR' },
      total: { amount: 45000, currency: 'INR' },
    },
    deliveryAddress: {
      label: 'Home',
      street: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560001',
      coordinates: { lat: 12.97, lng: 77.59 },
    },
    ...overrides,
  } as unknown as DomainEvent;
}

describe('OnOrderRequested', () => {
  it('maps the published payload to CreateFulfillment (orderRequestId = aggregateId)', async () => {
    const execute = jest.fn().mockResolvedValue(Result.ok({}));
    const createFulfillment = { execute } as unknown as CreateFulfillment;
    const handler = new OnOrderRequested(createFulfillment);

    await handler.handle(orderRequestedEvent());

    expect(execute).toHaveBeenCalledTimes(1);
    const dto = execute.mock.calls[0][0] as CreateFulfillmentDto;
    expect(dto.orderRequestId).toBe('order-req-1');
    expect(dto.customerId).toBe('cust-1');
    expect(dto.restaurantId).toBe('rest-1');
    expect(dto.total).toEqual({ amount: 45000, currency: 'INR' });
    expect(dto.lines).toHaveLength(1);
    expect(dto.lines[0].menuItemId).toBe('item-1');
    expect(dto.deliveryAddress.pinCode).toBe('560001');
  });

  // Phase 6 removed the per-handler in-memory `processedEventIds` set. Idempotency for this
  // path is `CreateFulfillment`'s `findByOrderRequestId` short-circuit plus the unique
  // `orderRequestId` index — durable, and the same guard the outbox relay will rely on.
  it('delegates every delivery — de-duplication belongs to CreateFulfillment', async () => {
    const execute = jest.fn().mockResolvedValue(Result.ok({}));
    const handler = new OnOrderRequested({ execute } as unknown as CreateFulfillment);

    const event = orderRequestedEvent();
    await handler.handle(event);
    await handler.handle(event);

    expect(execute).toHaveBeenCalledTimes(2);
  });

  // Phase 7 Batch 2: this handler runs in the outbox relay, so rejecting is what buys
  // the retry with backoff and eventually a FAILED row. Swallowing the failure here
  // meant a dropped order was invisible.
  it('rejects when CreateFulfillment fails so the relay retries the row', async () => {
    const execute = jest.fn().mockResolvedValue(Result.fail('boom'));
    const handler = new OnOrderRequested({ execute } as unknown as CreateFulfillment);

    await expect(handler.handle(orderRequestedEvent())).rejects.toThrow('boom');
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
