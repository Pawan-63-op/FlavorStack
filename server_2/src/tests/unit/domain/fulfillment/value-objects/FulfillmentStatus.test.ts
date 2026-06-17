import { FulfillmentStatus } from '../../../../../domain/fulfillment/value-objects/FulfillmentStatus';
import { FULFILLMENT_STATUS } from '../../../../../domain/fulfillment/enums/fulfillment-status.enum';

describe('FulfillmentStatus', () => {
  it('created() starts in CREATED and is not terminal', () => {
    const status = FulfillmentStatus.created();
    expect(status.value).toBe(FULFILLMENT_STATUS.CREATED);
    expect(status.isTerminal()).toBe(false);
  });

  it('create rejects an invalid status', () => {
    const result = FulfillmentStatus.create('NONSENSE' as never);
    expect(result.isFailure).toBe(true);
  });

  it('allows CREATED -> PREPARING and CREATED -> CANCELLED', () => {
    const status = FulfillmentStatus.created();
    expect(status.canTransitionTo(FULFILLMENT_STATUS.PREPARING)).toBe(true);
    expect(status.canTransitionTo(FULFILLMENT_STATUS.CANCELLED)).toBe(true);
    expect(status.transitionTo(FULFILLMENT_STATUS.PREPARING).getValue().value).toBe(
      FULFILLMENT_STATUS.PREPARING
    );
  });

  it('rejects an illegal jump CREATED -> DELIVERED', () => {
    const status = FulfillmentStatus.created();
    expect(status.canTransitionTo(FULFILLMENT_STATUS.DELIVERED)).toBe(false);
    expect(status.transitionTo(FULFILLMENT_STATUS.DELIVERED).isFailure).toBe(true);
  });

  it.each([FULFILLMENT_STATUS.DELIVERED, FULFILLMENT_STATUS.CANCELLED, FULFILLMENT_STATUS.FAILED])(
    'treats %s as terminal',
    (terminal) => {
      const status = FulfillmentStatus.create(terminal).getValue();
      expect(status.isTerminal()).toBe(true);
    }
  );
});
