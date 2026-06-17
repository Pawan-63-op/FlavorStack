import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { InMemoryOutboxStore } from '../../../mocks/identity.mocks';
import { createEventBusSpy } from '../../../mocks/shared.mocks';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';

function makeFakeEvent(): DomainEvent {
  return {
    eventId: 'evt-atomicity-test',
    occurredOn: new Date(),
    eventName: 'TestEvent',
    aggregateId: 'agg-1',
  };
}

describe('Negative atomicity harness', () => {
  it('post-commit publish is skipped when transaction commit fails (real use-case pattern)', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const outboxStore = new InMemoryOutboxStore();
    const eventBusSpy = createEventBusSpy();

    const fakeEvent = makeFakeEvent();

    // Simulate commit failure: work() runs (in-memory outbox gets written),
    // but the transaction throws on commit (DB rolls back in production).
    // The use-case pattern: publish ONLY after runInTransaction resolves successfully.
    unitOfWork.forceFailOnCommit(new Error('DB error'));

    let caught: Error | null = null;
    try {
      await unitOfWork.runInTransaction(async (ctx) => {
        await outboxStore.append([fakeEvent], ctx);
      });
      // This line is only reached on successful commit — skipped when tx throws.
      await eventBusSpy.publishAll([fakeEvent]);
    } catch (e) {
      caught = e as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).toBe('DB error');
    // work() ran so outbox received events (in prod these would be rolled back by DB tx)
    expect(outboxStore.appended).toHaveLength(1);
    // The critical invariant: bus publish is NEVER called when the transaction throws
    expect(eventBusSpy.publishedEvents).toHaveLength(0);
  });

  it('committed=true and outbox has events on successful transaction', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const outboxStore = new InMemoryOutboxStore();
    const eventBusSpy = createEventBusSpy();

    const fakeEvent = makeFakeEvent();

    await unitOfWork.runInTransaction(async (ctx) => {
      await outboxStore.append([fakeEvent], ctx);
    });
    await eventBusSpy.publishAll([fakeEvent]);

    expect(unitOfWork.committed).toBe(true);
    expect(outboxStore.appended).toHaveLength(1);
    expect(eventBusSpy.publishedEvents).toHaveLength(1);
  });
});
