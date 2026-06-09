import { Driver } from '../entities/Driver';
import { GeoPoint } from '../value-objects/GeoPoint.vo';

export interface IDriverRepository {
  findNearby(center: GeoPoint, radiusMeters: number): Promise<Driver[]>;
  findAvailable(): Promise<Driver[]>;
}
