import { WeeklySchedule } from '../../../domain/catalog/value-objects/OpeningHours.vo';
import { ActorContext } from './shared';

export interface SetOpeningHoursDto extends ActorContext {
  restaurantId: string;
  schedule: WeeklySchedule;
  holidays?: string[];
}
