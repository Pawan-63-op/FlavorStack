// MongoDB implementation of IDriverRepository (Phase 6, Batch 5).
//
// Adds the Driver-specific finders on top of the shared `users` collection.
// Writes go through MongoUserRepository (IUserRepository.save/update) — this
// repository only adds queries, reusing DriverModel + DriverMapper from
// Batch 1/2.
//
// findNearby uses the 2dsphere index on `currentLocation` (DriverModel.ts) via
// $near, which returns matches sorted nearest-first and naturally excludes
// drivers with `currentLocation: null`.
import type { ClientSession } from 'mongoose';
import { IDriverRepository } from '../../domain/identity/repositories/IDriverRepository';
import { Driver } from '../../domain/identity/entities/Driver';
import { GeoPoint } from '../../domain/identity/value-objects/GeoPoint.vo';
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
}
