import { DeliveryStatus } from '../../../../../domain/fulfillment/value-objects/DeliveryStatus';
import { DELIVERY_STATUS } from '../../../../../domain/fulfillment/enums/delivery-status.enum';

describe('DeliveryStatus VO', () => {
  it('starts at UNASSIGNED via the factory', () => {
    expect(DeliveryStatus.unassigned().value).toBe(DELIVERY_STATUS.UNASSIGNED);
  });

  it('rejects an invalid status value', () => {
    expect(DeliveryStatus.create('NONSENSE' as never).isFailure).toBe(true);
  });

  it('allows the happy-path collapsed lifecycle UNASSIGNED → ASSIGNED → PICKED_UP → EN_ROUTE_TO_CUSTOMER → DELIVERED', () => {
    const assigned = DeliveryStatus.unassigned().transitionTo(DELIVERY_STATUS.ASSIGNED);
    expect(assigned.isSuccess).toBe(true);

    const pickedUp = assigned.getValue().transitionTo(DELIVERY_STATUS.PICKED_UP);
    expect(pickedUp.isSuccess).toBe(true);

    const enRoute = pickedUp.getValue().transitionTo(DELIVERY_STATUS.EN_ROUTE_TO_CUSTOMER);
    expect(enRoute.isSuccess).toBe(true);

    const delivered = enRoute.getValue().transitionTo(DELIVERY_STATUS.DELIVERED);
    expect(delivered.isSuccess).toBe(true);
    expect(delivered.getValue().value).toBe(DELIVERY_STATUS.DELIVERED);
  });

  it('treats DELIVERED and FAILED as terminal', () => {
    const delivered = DeliveryStatus.create(DELIVERY_STATUS.DELIVERED).getValue();
    expect(delivered.isTerminal()).toBe(true);
    expect(delivered.transitionTo(DELIVERY_STATUS.PICKED_UP).isFailure).toBe(true);

    const failed = DeliveryStatus.create(DELIVERY_STATUS.FAILED).getValue();
    expect(failed.isTerminal()).toBe(true);
  });

  it('rejects an illegal jump (UNASSIGNED → DELIVERED)', () => {
    expect(DeliveryStatus.unassigned().transitionTo(DELIVERY_STATUS.DELIVERED).isFailure).toBe(true);
  });
});
