// Commerce Phase 9 — snapshot schema versioning strategy (commerce_module.md §6.4).
//
// Every embedded snapshot VO (RestaurantSnapshot, MenuItemSnapshot, VariantSnapshot,
// PricingSnapshot) and the OrderRequest that embeds them carries a `schemaVersion`.
// New snapshots are stamped with COMMERCE_SNAPSHOT_SCHEMA_VERSION at creation time.
// When a snapshot shape changes, bump this constant and have readers branch on the
// `schemaVersion` stored on each already-persisted OrderRequest — old snapshots stay
// valid and reproducible forever, they are never migrated in place.
export const COMMERCE_SNAPSHOT_SCHEMA_VERSION = 1;
