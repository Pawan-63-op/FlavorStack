// UC: GetAdminDashboard — returns the admin fulfillment dashboard with optional filters
// (fulfillment_module.md §6.2 / §7.4, Phase 6). No transaction; reads from AdminDashboardView projection.
import { Result } from '../../../domain/shared/Result';
import {
  IFulfillmentProjectionRepository,
  AdminDashboardView,
} from '../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';
import { IFulfillmentReadCache } from '../../../domain/fulfillment/services/IFulfillmentCache';
import { GetAdminDashboardDto } from '../dtos/GetAdminDashboardDto';
import { AdminDashboardItemResponse, toAdminDashboardItemResponse } from '../responses/AdminDashboardResponse';

export class GetAdminDashboard {
  constructor(
    private readonly projectionRepo: IFulfillmentProjectionRepository,
    private readonly cache?: IFulfillmentReadCache
  ) {}

  async execute(dto: GetAdminDashboardDto): Promise<Result<AdminDashboardItemResponse[]>> {
    const query = {
      status: dto.status,
      slaBreached: dto.slaBreached,
      restaurantId: dto.restaurantId,
      limit: dto.limit,
      offset: dto.offset,
    };
    const loadItems = (): Promise<AdminDashboardView[]> => this.projectionRepo.findAdminDashboard(query);
    const items = this.cache
      ? await this.cache.rememberDashboard(dashboardDiscriminator(dto), loadItems)
      : await loadItems();
    return Result.ok(items.map(toAdminDashboardItemResponse));
  }
}

/** Deterministic cache discriminator for one dashboard filter combination. */
function dashboardDiscriminator(dto: GetAdminDashboardDto): string {
  return [
    `status=${dto.status ?? ''}`,
    `sla=${dto.slaBreached ?? ''}`,
    `rest=${dto.restaurantId ?? ''}`,
    `limit=${dto.limit ?? ''}`,
    `offset=${dto.offset ?? ''}`,
  ].join('|');
}
