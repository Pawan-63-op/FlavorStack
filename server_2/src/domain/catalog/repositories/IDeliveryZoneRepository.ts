import { GeoPoint } from '../../identity/value-objects/GeoPoint.vo';
import { DeliveryZone } from '../entities/DeliveryZone';

export interface IDeliveryZoneRepository {
  findZoneContaining(point: GeoPoint): Promise<DeliveryZone[]>;
}
