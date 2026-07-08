import type { ClientSession } from 'mongoose';
import { IDriverRepository } from '../../domain/identity/repositories/IDriverRepository';
import { Driver } from '../../domain/identity/entities/Driver';
import { GeoPoint } from '../../domain/identity/value-objects/GeoPoint.vo';
import { DriverStatus } from '../../domain/identity/enums/driver-status.enum';
import { TransactionContext } from '../database/TransactionContext';
import { DriverModel, DriverDocument } from '../database/models/DriverModel';
import { DriverMapper } from '../database/mappers/DriverMapper';

export class MongoDriverRepository implements IDriverRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findNearby(center: GeoPoint, radiusMeters: number): Promise<Driver[]> {
    const docs = await DriverModel.find(
      {
        deletedAt: null,
        currentLocation: {
          $near: {
            $geometry: { type: 'Point', coordinates: [center.lng, center.lat] },
            $maxDistance: radiusMeters,
          },
        },
      },
      null,
      { session: this.session },
    ).lean<DriverDocument[]>();
    return docs.map((doc) => DriverMapper.toDomain(doc));
  }

  async findAvailable(): Promise<Driver[]> {
    const docs = await DriverModel.find({ isAvailable: true, deletedAt: null }, null, {
      session: this.session,
    }).lean<DriverDocument[]>();
    return docs.map((doc) => DriverMapper.toDomain(doc));
  }

  async findByStatus(status?: DriverStatus): Promise<Driver[]> {
    const filter: Record<string, unknown> = { deletedAt: null };
    if (status) filter.driverStatus = status;
    const docs = await DriverModel.find(filter, null, { session: this.session })
      .sort({ createdAt: -1 })
      .lean<DriverDocument[]>();
    return docs.map((doc) => DriverMapper.toDomain(doc));
  }
}
