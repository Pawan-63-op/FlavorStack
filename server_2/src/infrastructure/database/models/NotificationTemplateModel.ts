// Mongoose schema — `notification_templates` collection (engagement_module.md §6).
// Key: unique key+channel+locale.
import { Schema, model } from 'mongoose';

export interface NotificationTemplateDocument {
  _id: string;
  key: string;
  channel: string;
  locale: string;
  titleTemplate: string;
  bodyTemplate: string;
  active: boolean;
}

const NotificationTemplateSchema = new Schema<NotificationTemplateDocument>(
  {
    _id: { type: String, required: true },
    key: { type: String, required: true },
    channel: { type: String, required: true },
    locale: { type: String, required: true },
    titleTemplate: { type: String, required: true },
    bodyTemplate: { type: String, required: true },
    active: { type: Boolean, required: true, default: true },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'notification_templates',
  }
);

NotificationTemplateSchema.index({ key: 1, channel: 1, locale: 1 }, { unique: true });

export const NotificationTemplateModel = model<NotificationTemplateDocument>(
  'NotificationTemplate',
  NotificationTemplateSchema
);
