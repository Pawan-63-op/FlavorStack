// Review moderation lifecycle states (engagement_module.md §2): PENDING/AUTO_FLAGGED → APPROVED | REJECTED.
export const MODERATION_STATUS = {
  PENDING: 'PENDING',
  AUTO_FLAGGED: 'AUTO_FLAGGED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ModerationStatusValue = (typeof MODERATION_STATUS)[keyof typeof MODERATION_STATUS];
