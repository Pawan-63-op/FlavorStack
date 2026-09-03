import { Result } from '../../../domain/shared/Result';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { IDeliveryZoneRepository } from '../../../domain/catalog/repositories/IDeliveryZoneRepository';
import { ICatalogQueryRepository } from '../../../domain/catalog/repositories/ICatalogQueryRepository';
import { ListDeliverableRestaurantsDto } from '../dtos/QueryDtos';
import { deliverableRestaurantIds, findServiceableZones } from './serviceability-helpers';

export interface DeliverableRestaurantsView {
  restaurantIds: string[];
}

/**
 * Answers "which restaurants deliver to this point?" — no `Money`, no fee matrix, no
 * cheapest-zone reduction. Used by browse (`deliverableOnly`) and by the
 * `/catalog/deliverable` endpoint. It shares `findServiceableZones` with
 * `CheckServiceability`, so both agree on which restaurants are reachable.
 */
export class ListDeliverableRestaurants {
  constructor(
    private readonly deliveryZoneRepo: IDeliveryZoneRepository,
    private readonly queryRepo: ICatalogQueryRepository
  ) {}

  async execute(dto: ListDeliverableRestaurantsDto): Promise<Result<DeliverableRestaurantsView>> {
    const pointResult = GeoPoint.create(dto.lat, dto.lng);
    if (pointResult.isFailure) return Result.fail(pointResult.getError());

    const matches = await findServiceableZones(
      this.deliveryZoneRepo,
      this.queryRepo,
      pointResult.getValue()
    );
    return Result.ok({ restaurantIds: deliverableRestaurantIds(matches) });
  }
}
