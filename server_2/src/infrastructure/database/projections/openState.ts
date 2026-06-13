// Derived open-state logic for catalog read queries (Catalog Phase 9).
//
// `isOpen` is NEVER persisted — it depends on the current instant and so is
// computed at read time from the restaurant's status + opening hours. A restaurant
// is open iff it is ACTIVE and the wall-clock falls inside its opening hours (a
// restaurant with no opening hours configured is treated as always-open while
// ACTIVE). Effective item availability ANDs the item's own toggle with this.
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
