// Mongoose schema — single shared `outbox` collection (Phase 6 plan §5.4 / §9).
// Written atomically with aggregate saves inside MongoUnitOfWork transactions;
// read by the (Phase 8) OutboxPoller via findPending/markProcessed.
import { Schema, model, Types } from 'mongoose';

export const OUTBOX_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const;
export type OutboxStatus = (typeof OUTBOX_STATUS)[keyof typeof OUTBOX_STATUS];

export interface OutboxEventDocument {
  _id: Types.ObjectId;
  eventId: string;
  eventName: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  retryCount: number;
  createdAt: Date;
  processedAt: Date | null;
}

const OutboxEventSchema = new Schema<OutboxEventDocument>(
  {
    eventId: { type: String, required: true, unique: true },
    eventName: { type: String, required: true },
    aggregateId: { type: String, required: true },
    aggregateType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: Object.values(OUTBOX_STATUS), default: OUTBOX_STATUS.PENDING },
    retryCount: { type: Number, default: 0 },
    createdAt: { type: Date, required: true, default: Date.now },
    processedAt: { type: Date, default: null },
  },
  {
    versionKey: false,
    collection: 'outbox',
  }
);

// Poller's findPending(limit): { status: 'PENDING' } sorted by createdAt.
OutboxEventSchema.index({ status: 1, createdAt: 1 });

export const OutboxEventModel = model<OutboxEventDocument>('OutboxEvent', OutboxEventSchema);
