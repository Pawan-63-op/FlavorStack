import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export type CategoryChangeAction = 'UPDATED' | 'REORDERED' | 'REMOVED';

export class CategoryUpdated implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'CategoryUpdated';
  public readonly aggregateId: string;

  constructor(
    restaurantId: string,
    public readonly categoryId: string | null,
    public readonly action: CategoryChangeAction
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = restaurantId;
  }
}
