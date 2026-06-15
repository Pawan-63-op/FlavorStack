// Mongoose schema — `commerce_catalog_view_checkpoints` collection (Commerce Phase 5).
//
// Idempotency ledger for `CommerceCatalogProjector`: one document per processed
// `eventId`. `_id` is unique, so a redelivered event (same `eventId`, at-least-once
// outbox delivery) fails the insert with E11000 and the projector treats it as an
// already-applied no-op — mirrors the eventId-dedup convention used across the
// outbox/worker chain.
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
