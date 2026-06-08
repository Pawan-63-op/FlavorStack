import { AggregateRoot } from '../../../../domain/shared/AggregateRoot';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';
import { UniqueEntityId } from '../../../../domain/shared/UniqueEntityId';

// Define a concrete subclass of AggregateRoot for testing
interface TestAggregateProps {
  name: string;
}

class TestAggregate extends AggregateRoot<TestAggregateProps> {
  public static create(props: TestAggregateProps, id?: UniqueEntityId): TestAggregate {
    return new TestAggregate(props, id);
  }
}

// Define a test domain event
class TestDomainEvent implements DomainEvent {
  public eventId: string;
  public occurredOn: Date;
  public eventName: string;
  public aggregateId: string;

  constructor(aggregateId: string) {
    this.eventId = 'test-event-id';
    this.occurredOn = new Date();
    this.eventName = 'TestDomainEvent';
    this.aggregateId = aggregateId;
  }
}

describe('AggregateRoot', () => {
  it('should initialize with an empty list of domain events', () => {
    const aggregate = TestAggregate.create({ name: 'Test' });
    expect(aggregate.domainEvents.length).toBe(0);
  });

  it('should collect added domain events', () => {
    const aggregate = TestAggregate.create({ name: 'Test' });
    const event = new TestDomainEvent(aggregate.id.toString());

    aggregate.addDomainEvent(event);

    expect(aggregate.domainEvents.length).toBe(1);
    expect(aggregate.domainEvents[0]).toBe(event);
  });

  it('should return events and clear them upon pulling', () => {
    const aggregate = TestAggregate.create({ name: 'Test' });
    const event1 = new TestDomainEvent(aggregate.id.toString());
    const event2 = new TestDomainEvent(aggregate.id.toString());

    aggregate.addDomainEvent(event1);
    aggregate.addDomainEvent(event2);

    // Pull events
    const pulledEvents = aggregate.pullDomainEvents();

    expect(pulledEvents.length).toBe(2);
    expect(pulledEvents[0]).toBe(event1);
    expect(pulledEvents[1]).toBe(event2);

    // Second pull must be empty (pull-and-clear)
    const secondPull = aggregate.pullDomainEvents();
    expect(secondPull.length).toBe(0);
    expect(aggregate.domainEvents.length).toBe(0);
  });

  it('should allow clearing domain events manually', () => {
    const aggregate = TestAggregate.create({ name: 'Test' });
    const event = new TestDomainEvent(aggregate.id.toString());

    aggregate.addDomainEvent(event);
    expect(aggregate.domainEvents.length).toBe(1);

    aggregate.clearDomainEvents();
    expect(aggregate.domainEvents.length).toBe(0);
  });
});
