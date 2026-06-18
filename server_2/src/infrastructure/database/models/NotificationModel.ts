// Mongoose schema — `notifications` collection (engagement_module.md §6).
// Indexes: recipientUserId+createdAt (history paging); unique sparse dedupeKey
// (at-least-once dispatch idempotency); status (unread counts).
import { Schema, model } from 'mongoose';

export interface NotificationDocument {
  _id: string;
  recipientUserId: string;
  category: string;
  channel: string;
  templateKey: string;
  renderedTitle: string;
  renderedBody: string;
  status: string;
  dedupeKey: string;
  provider?: string;
  createdAt: Date;
  sentAt?: Date;
  failedReason?: string;
  readAt?: Date;
}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    _id: { type: String, required: true },
    recipientUserId: { type: String, required: true },
    category: { type: String, required: true },
    channel: { type: String, required: true },
    templateKey: { type: String, required: true },
    renderedTitle: { type: String, required: true },
    renderedBody: { type: String, required: true },
    status: { type: String, required: true },
    dedupeKey: { type: String, required: true },
    provider: { type: String, required: false },
    createdAt: { type: Date, required: true },
    sentAt: { type: Date, required: false },
    failedReason: { type: String, required: false },
    readAt: { type: Date, required: false },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'notifications',
  }
);

NotificationSchema.index({ recipientUserId: 1, createdAt: -1 });
NotificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });
NotificationSchema.index({ status: 1 });

export const NotificationModel = model<NotificationDocument>('Notification', NotificationSchema);
