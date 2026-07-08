import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';

export function triedRiderIds(fulfillment: Fulfillment): string[] {
  const tried = fulfillment.assignmentHistory.map((a) => a.riderId);
  if (fulfillment.currentAssignment) tried.push(fulfillment.currentAssignment.riderId);
  return tried;
}

export function offerExpiry(ttlSeconds: number): Date {
  return new Date(Date.now() + ttlSeconds * 1000);
}
