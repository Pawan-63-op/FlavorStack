// Domain <-> persistence mapping for the Driver aggregate (DRIVER discriminator).
// Implements src/domain/identity/entities/Driver.ts <-> DriverDocument (DriverModel.ts).
import { Driver } from '../../../domain/identity/entities/Driver';
import { DriverDocument, GeoJsonPointDocument } from '../models/DriverModel';
import { VehicleInfo } from '../../../domain/identity/value-objects/VehicleInfo.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { baseToDomain, baseToPersistence, rebuildOrThrow } from './BaseUserMapper';

export class DriverMapper {
  static toPersistence(driver: Driver): DriverDocument {
    return {
      ...baseToPersistence(driver),
      driverStatus: driver.driverStatus,
      vehicle: {
        type: driver.vehicle.type,
        brand: driver.vehicle.brand,
        model: driver.vehicle.model,
        licensePlate: driver.vehicle.licensePlate,
        rcDocumentUrl: driver.vehicle.rcDocumentUrl,
        insuranceUrl: driver.vehicle.insuranceUrl,
      },
      currentLocation: driver.currentLocation ? driver.currentLocation.toGeoJson() : null,
      locationUpdatedAt: driver.locationUpdatedAt,
      isAvailable: driver.isAvailable,
      activeOrderId: driver.activeOrderId,
      totalEarnings: driver.totalEarnings,
      pendingPayout: driver.pendingPayout,
      stripeAccountId: driver.stripeAccountId,
      averageRating: driver.averageRating,
      totalDeliveries: driver.totalDeliveries,
      totalRatings: driver.totalRatings,
      fcmTokens: driver.fcmTokens,
    };
  }

  static toDomain(doc: DriverDocument): Driver {
    const driver = new Driver({
      ...baseToDomain(doc),
      driverStatus: doc.driverStatus,
      vehicle: rebuildOrThrow(VehicleInfo.create(doc.vehicle), `Driver vehicle (${doc._id})`),
      currentLocation: geoJsonToDomain(doc.currentLocation, doc._id),
      locationUpdatedAt: doc.locationUpdatedAt,
      isAvailable: doc.isAvailable,
      activeOrderId: doc.activeOrderId,
      totalEarnings: doc.totalEarnings,
      pendingPayout: doc.pendingPayout,
      stripeAccountId: doc.stripeAccountId,
      averageRating: doc.averageRating,
      totalDeliveries: doc.totalDeliveries,
      totalRatings: doc.totalRatings,
      fcmTokens: doc.fcmTokens,
    });
    driver.clearDomainEvents();
    return driver;
  }
}

function geoJsonToDomain(doc: GeoJsonPointDocument | null, driverId: string): GeoPoint | null {
  if (!doc) return null;
  const [lng, lat] = doc.coordinates;
  return rebuildOrThrow(GeoPoint.create(lat, lng), `Driver currentLocation (${driverId})`);
}
