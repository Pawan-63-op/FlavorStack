export type AnalyticsScope = 'OWNER' | 'PLATFORM';

export interface GetDashboardAnalyticsDto {
  scope: AnalyticsScope;
  /** Required when `scope === 'OWNER'` — the authenticated user whose restaurants to scope to. */
  ownerId?: string;
  /** Trailing window length in days; defaults to 30. The trend compares against the prior window. */
  windowDays?: number;
}
