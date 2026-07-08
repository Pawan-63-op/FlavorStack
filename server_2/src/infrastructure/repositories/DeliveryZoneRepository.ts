import type { ClientSession } from 'mongoose';
import { IDeliveryZoneRepository } from '../../domain/catalog/repositories/IDeliveryZoneRepository';
import { DeliveryZone } from '../../domain/catalog/entities/DeliveryZone';
import { GeoPoint } from '../../domain/identity/value-objects/GeoPoint.vo';
import { TransactionContext } from '../database/TransactionContext';
import { RestaurantModel, RestaurantDocument } from '../database/models/RestaurantModel';
import { RestaurantMapper } from '../database/mappers/RestaurantMapper';

export class MongoDeliveryZoneRepository implements IDeliveryZoneRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findZoneContaining(point: GeoPoint): Promise<DeliveryZone[]> {
    const docs = await RestaurantModel.find(
      {
        deletedAt: null,
        'deliveryZones.polygon': {
          $geoIntersects: { $geometry: point.toGeoJson() },
        },
      },
      null,
      { session: this.session }
    ).lean<RestaurantDocument[]>();

    const zones: DeliveryZone[] = [];
    for (const doc of docs) {
      const restaurant = RestaurantMapper.toDomain(doc);
      for (const zone of restaurant.deliveryZones) {
        if (zone.polygon.contains(point)) {
          zones.push(zone);
        }
      }
    }
    return zones;
  }
}
