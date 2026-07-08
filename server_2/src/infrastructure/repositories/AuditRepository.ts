import type { ClientSession } from 'mongoose';
import { TransactionContext } from '../database/TransactionContext';
import { AuditLogModel, AuditLogDocument } from '../database/models/AuditLogModel';

export interface AuditLogEntry {
  actorId: string;
  action: string;
  targetModel?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  performedAt?: Date;
  details?: string;
  ipAddress?: string;
}

export class MongoAuditRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  /** Persist a single audit log row, defaulting `performedAt` to now. */
  async create(entry: AuditLogEntry): Promise<void> {
    await AuditLogModel.create([{ performedAt: new Date(), ...entry }], { session: this.session });
  }

  /** Rows for an actor, most recent first, capped at `limit` (uses the {actorId, performedAt} index). */
  async findByActorId(actorId: string, limit = 50): Promise<AuditLogDocument[]> {
    return AuditLogModel.find({ actorId }, null, { session: this.session })
      .sort({ performedAt: -1 })
      .limit(limit)
      .lean<AuditLogDocument[]>();
  }
}
