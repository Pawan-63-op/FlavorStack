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
  nextAttemptAt: Date;
  lastError: string | null;
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
    nextAttemptAt: { type: Date, required: true, default: Date.now },
    lastError: { type: String, default: null },
  },
  {
    versionKey: false,
    collection: 'outbox',
  }
);

OutboxEventSchema.index({ status: 1, nextAttemptAt: 1 });

export const OutboxEventModel = model<OutboxEventDocument>('OutboxEvent', OutboxEventSchema);
