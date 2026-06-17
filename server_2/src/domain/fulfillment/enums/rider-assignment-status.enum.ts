// Per-attempt rider assignment states (fulfillment_module.md §2.4 / §4.2). Defined now for the
// enum contract; the RiderAssignment entity + RiderAssignmentStatus VO are realized in Phase 3.
export const RIDER_ASSIGNMENT_STATUS = {
  OFFERED: 'OFFERED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  REASSIGNED: 'REASSIGNED',
} as const;

export type RiderAssignmentStatusValue =
  (typeof RIDER_ASSIGNMENT_STATUS)[keyof typeof RIDER_ASSIGNMENT_STATUS];
