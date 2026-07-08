import { Schema, model, Types } from 'mongoose';

export interface AuditLogDocument {
  _id: Types.ObjectId;
  actorId: string;
  action: string;
  targetModel?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  performedAt: Date;
  details?: string;
  ipAddress?: string;
}

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    targetModel: { type: String },
    targetId: { type: String },
    meta: { type: Schema.Types.Mixed },
    performedAt: { type: Date, required: true, default: Date.now },
    details: { type: String },
    ipAddress: { type: String },
  },
  {
    versionKey: false,
    collection: 'audit_logs',
  }
);

AuditLogSchema.index({ actorId: 1, performedAt: 1 });

export const AuditLogModel = model<AuditLogDocument>('AuditLog', AuditLogSchema);
