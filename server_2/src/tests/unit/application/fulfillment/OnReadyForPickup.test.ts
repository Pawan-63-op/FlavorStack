import { OnReadyForPickup } from '../../../../application/fulfillment/event-handlers/OnReadyForPickup';
import { OfferRiderAssignment } from '../../../../application/fulfillment/use-cases/OfferRiderAssignment';
import { Result } from '../../../../domain/shared/Result';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';

function readyEvent(fulfillmentId = 'ful-1', eventId = 'evt-1'): DomainEvent {
  return {
    eventId,
    occurredOn: new Date(),
    eventName: 'ReadyForPickup',
    aggregateId: fulfillmentId,
  };
}

function makeOffer(result = Result.ok({} as never)) {
  return { execute: jest.fn().mockResolvedValue(result) } as unknown as jest.Mocked<OfferRiderAssignment>;
}

describe('OnReadyForPickup (auto-offer)', () => {
  it('invokes OfferRiderAssignment with the fulfillmentId from the event', async () => {
    const offer = makeOffer();
    const handler = new OnReadyForPickup(offer);

    await handler.handle(readyEvent('ful-1'));

    expect(offer.execute).toHaveBeenCalledWith({ fulfillmentId: 'ful-1' });
  });

  it('is idempotent: a redelivered eventId does not re-offer', async () => {
    const offer = makeOffer();
    const handler = new OnReadyForPickup(offer);
    const event = readyEvent('ful-1', 'evt-dup');

    await handler.handle(event);
    await handler.handle(event);

    expect(offer.execute).toHaveBeenCalledTimes(1);
  });

  it('does NOT mark processed on failure, so a redelivery can retry', async () => {
    const offer = makeOffer(Result.fail(new ConflictError('no_available_rider')));
    const handler = new OnReadyForPickup(offer);
    const event = readyEvent('ful-1', 'evt-retry');

    await handler.handle(event);
    await handler.handle(event);

    expect(offer.execute).toHaveBeenCalledTimes(2);
  });
});
