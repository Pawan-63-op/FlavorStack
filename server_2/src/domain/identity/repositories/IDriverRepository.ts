import { Driver } from '../entities/Driver';
import { GeoPoint } from '../value-objects/GeoPoint.vo';
import { DriverStatus } from '../enums/driver-status.enum';

export interface IDriverRepository {
  findNearby(center: GeoPoint, radiusMeters: number): Promise<Driver[]>;
  findAvailable(): Promise<Driver[]>;
  /**
   * Admin listing (G5). Returns drivers newest-first; when `status` is provided,
   * restricts to that driverStatus (e.g. PENDING_VERIFICATION for the verify queue).
   */
  findByStatus(status?: DriverStatus): Promise<Driver[]>;
}
