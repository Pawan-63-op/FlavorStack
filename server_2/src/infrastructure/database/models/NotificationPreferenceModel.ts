import { Schema, model } from 'mongoose';

/**
 * `push` is the pre-Phase-5 field name, kept optional so a document written before the
 * `channels.*.push → channels.*.inbox` `$rename` still reads (see NotificationPreferenceMapper).
 * Writes always emit `inbox`.
 */
export interface ChannelToggleDocument {
  inbox?: boolean;
  push?: boolean;
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
