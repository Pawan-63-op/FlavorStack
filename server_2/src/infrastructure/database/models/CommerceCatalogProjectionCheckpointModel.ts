import { Schema, model } from 'mongoose';

export interface CommerceCatalogProjectionCheckpointDocument {
  _id: string; // eventId
  eventName: string;
  restaurantId: string;
  processedAt: Date;
}

const CommerceCatalogProjectionCheckpointSchema = new Schema<CommerceCatalogProjectionCheckpointDocument>(
  {
    _id: { type: String, required: true },
    eventName: { type: String, required: true },
    restaurantId: { type: String, required: true },
    processedAt: { type: Date, required: true },
  },
  { versionKey: false, collection: 'commerce_catalog_view_checkpoints' }
);

export const CommerceCatalogProjectionCheckpointModel = model<CommerceCatalogProjectionCheckpointDocument>(
  'CommerceCatalogProjectionCheckpoint',
  CommerceCatalogProjectionCheckpointSchema
);
