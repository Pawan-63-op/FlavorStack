import { DomainEvent } from '../../../domain/shared/DomainEvent';

export interface IOutboxStore {
  append(events: DomainEvent[], ctx: unknown): Promise<void>;
}
