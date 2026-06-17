// Small shared helpers for the rider-assignment use cases (fulfillment_module.md §6.1, Phase 3B).
import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';

// Riders already tried on this fulfillment (the active offer + every prior attempt) — never re-offer
// to them when asking IDeliveryAssignmentService for the next candidate.
export function triedRiderIds(fulfillment: Fulfillment): string[] {
  const tried = fulfillment.assignmentHistory.map((a) => a.riderId);
  if (fulfillment.currentAssignment) tried.push(fulfillment.currentAssignment.riderId);
  return tried;
}

// Absolute expiry for a new offer, derived from the configured TTL.
export function offerExpiry(ttlSeconds: number): Date {
  return new Date(Date.now() + ttlSeconds * 1000);
}
