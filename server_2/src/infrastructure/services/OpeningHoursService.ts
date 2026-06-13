// MongoOpeningHoursService — projection-driven implementation of
// IOpeningHoursService (Catalog Phase 9). Reads the restaurant_summary projection
// and reuses the shared `deriveIsOpen` rule (ACTIVE + within opening hours).
import { IOpeningHoursService } from '../../domain/catalog/services/IOpeningHoursService';
import { RestaurantSummaryModel, RestaurantSummaryDocument } from '../database/models/RestaurantSummaryModel';
import { deriveIsOpen } from '../database/projections/openState';

export class MongoOpeningHoursService implements IOpeningHoursService {
  async isRestaurantOpen(restaurantId: string, at?: Date): Promise<boolean> {
    const doc = await RestaurantSummaryModel.findOne({
      _id: restaurantId,
      deletedAt: null,
    }).lean<RestaurantSummaryDocument>();
    if (!doc) return false;
    return deriveIsOpen(
      { status: doc.status, openingHours: doc.openingHours, tzOffsetMinutes: doc.tzOffsetMinutes },
      at ?? new Date()
    );
  }
}
