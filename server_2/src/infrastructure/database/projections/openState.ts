import { RESTAURANT_STATUS } from '../../../domain/catalog/enums/restaurant-status.enum';
import { OpeningHours, WeeklySchedule } from '../../../domain/catalog/value-objects/OpeningHours.vo';
import { OpeningHoursDocument } from '../models/RestaurantModel';

export interface OpenStateInput {
  status: string;
  openingHours: OpeningHoursDocument | null;
  tzOffsetMinutes?: number;
}

export function deriveIsOpen(input: OpenStateInput, now: Date = new Date()): boolean {
  if (input.status !== RESTAURANT_STATUS.ACTIVE) {
    return false;
  }
  if (!input.openingHours) {
    return true;
  }
  const built = OpeningHours.create({
    schedule: input.openingHours.schedule as WeeklySchedule,
    holidays: input.openingHours.holidays,
  });
  if (built.isFailure) {
    return false;
  }
  return built.getValue().isOpenAt(now, input.tzOffsetMinutes ?? 0);
}
