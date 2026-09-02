import { Result } from '../../../domain/shared/Result';
import {
  IFulfillmentQueryRepository,
  AdminDashboardView,
} from '../../../domain/fulfillment/repositories/IFulfillmentQueryRepository';
import { IFulfillmentReadCache } from '../../../domain/fulfillment/services/IFulfillmentCache';
import { GetAdminDashboardDto } from '../dtos/GetAdminDashboardDto';
import { AdminDashboardItemResponse, toAdminDashboardItemResponse } from '../responses/AdminDashboardResponse';

export class GetAdminDashboard {
  constructor(
    private readonly queryRepo: IFulfillmentQueryRepository,
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
    const loadItems = (): Promise<AdminDashboardView[]> => this.queryRepo.findAdminDashboard(query);
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
