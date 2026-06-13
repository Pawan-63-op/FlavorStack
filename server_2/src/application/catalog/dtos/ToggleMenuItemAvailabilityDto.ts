import { ActorContext } from './shared';

export interface ToggleMenuItemAvailabilityDto extends ActorContext {
  itemId: string;
  isAvailable: boolean;
  availableFrom?: Date;
  availableUntil?: Date;
  outOfStockReason?: string;
}
