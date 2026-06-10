// Mongoose discriminator — `users` collection, role: DRIVER.
// Implements the persisted shape of Driver (src/domain/identity/entities/Driver.ts).
import { Schema } from 'mongoose';
import { UserModel, UserDocument } from './UserModel';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { DRIVER_STATUS, DriverStatus } from '../../../domain/identity/enums/driver-status.enum';

// Mirrors VehicleInfo.vo.ts (all fields required by VehicleInfo.create()).
export interface VehicleInfoDocument {
  type: string;
  brand: string;
  model: string;
  licensePlate: string;
  rcDocumentUrl: string;
  insuranceUrl: string;
}

// GeoJSON Point — matches GeoPoint.vo.ts#toGeoJson() ([lng, lat] order).
export interface GeoJsonPointDocument {
  type: 'Point';
  coordinates: [number, number];
}

export interface DriverDocument extends UserDocument {
  driverStatus: DriverStatus;
  vehicle: VehicleInfoDocument;
  currentLocation: GeoJsonPointDocument | null;
  locationUpdatedAt: Date | null;
  isAvailable: boolean;
  activeOrderId: string | null;
  totalEarnings: number;
  pendingPayout: number;
  stripeAccountId: string | null;
  averageRating: number;
  totalDeliveries: number;
  totalRatings: number;
  fcmTokens: string[];
}

const VehicleInfoSchema = new Schema<VehicleInfoDocument>(
  {
    type: { type: String, required: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    licensePlate: { type: String, required: true },
    rcDocumentUrl: { type: String, required: true },
    insuranceUrl: { type: String, required: true },
  },
  { _id: false }
);

const GeoJsonPointSchema = new Schema<GeoJsonPointDocument>(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const DriverSchema = new Schema<DriverDocument>({
  driverStatus: {
    type: String,
    enum: Object.values(DRIVER_STATUS),
    default: DRIVER_STATUS.PENDING_VERIFICATION,
  },
  vehicle: { type: VehicleInfoSchema, required: true },
  currentLocation: { type: GeoJsonPointSchema, default: null },
  locationUpdatedAt: { type: Date, default: null },
  isAvailable: { type: Boolean, default: false },
  activeOrderId: { type: String, default: null },
  totalEarnings: { type: Number, default: 0 },
  pendingPayout: { type: Number, default: 0 },
  stripeAccountId: { type: String, default: null },
  averageRating: { type: Number, default: 0 },
  totalDeliveries: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  fcmTokens: { type: [String], default: [] },
});

// Geospatial finder support (IDriverRepository.findNearby) + availability finder (findAvailable).
DriverSchema.index({ currentLocation: '2dsphere' });
DriverSchema.index({ isAvailable: 1 });

export const DriverModel = UserModel.discriminator<DriverDocument>(USER_ROLE.DRIVER, DriverSchema);
