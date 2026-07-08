import { Schema, model } from 'mongoose';

export interface ChannelToggleDocument {
  push: boolean;
  email: boolean;
}

export interface NotificationPreferenceDocument {
  _id: string;
  userId: string;
  channels: Record<string, ChannelToggleDocument>;
  updatedAt: Date;
}

const NotificationPreferenceSchema = new Schema<NotificationPreferenceDocument>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    channels: { type: Object, required: true },
    updatedAt: { type: Date, required: true },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'notification_preferences',
  }
);

NotificationPreferenceSchema.index({ userId: 1 }, { unique: true });

export const NotificationPreferenceModel = model<NotificationPreferenceDocument>(
  'NotificationPreference',
  NotificationPreferenceSchema
);
