export interface GetAdminDashboardDto {
  status?: string;
  slaBreached?: boolean;
  restaurantId?: string;
  limit?: number;
  offset?: number;
}
