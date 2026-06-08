export interface DomainEvent {
  eventId: string;
  occurredOn: Date;
  eventName: string;
  aggregateId: string;
}
