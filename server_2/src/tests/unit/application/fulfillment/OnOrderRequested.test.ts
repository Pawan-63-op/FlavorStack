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

  it('dedups a redelivered eventId after a successful handle', async () => {
    const execute = jest.fn().mockResolvedValue(Result.ok({}));
    const handler = new OnOrderRequested({ execute } as unknown as CreateFulfillment);

    const event = orderRequestedEvent();
    await handler.handle(event);
    await handler.handle(event);

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('does NOT dedup when the use case fails (allows retry)', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce(Result.fail('boom'))
      .mockResolvedValueOnce(Result.ok({}));
    const handler = new OnOrderRequested({ execute } as unknown as CreateFulfillment);

    const event = orderRequestedEvent();
    await handler.handle(event);
    await handler.handle(event);

    expect(execute).toHaveBeenCalledTimes(2);
  });
});
