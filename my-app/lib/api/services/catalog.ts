import {
  menuAdapter,
  menuItemDetailAdapter,
  menuItemSearchAdapter,
  type MenuItemDetailResponse,
  type MenuItemDetailViewModel,
  type MenuItemSearchResponse,
  type MenuItemSearchViewModel,
  type MenuViewModel,
  type RestaurantMenuResponse,
} from "../adapters/menu";
import {
  restaurantAdapter,
  type CuisineType,
  type RestaurantSummaryResponse,
  type RestaurantViewModel,
} from "../adapters/restaurant";
import { client } from "../client/http";
import { formatMoney, type Money } from "../format/money";
import { normalizePage, type NormalizedPage, type RawPage } from "../pagination";

export interface RestaurantListParams {
  cursor?: string;
  limit?: number;
  cuisineTypes?: CuisineType[];
  isOpen?: boolean;
  /** Server-side intersection with `/catalog/deliverable`; requires `lat`/`lng`. */
  deliverableOnly?: boolean;
  lat?: number;
  lng?: number;
}

export interface DeliverablePointParams {
  lat: number;
  lng: number;
}

/** server_2 `DeliverableRestaurantsView` (`GET /catalog/deliverable`). */
export interface DeliverableRestaurantsResponse {
  restaurantIds: string[];
}

export interface SearchRestaurantsParams {
  query: string;
  cuisineTypes?: CuisineType[];
  isOpenNow?: boolean;
  cursor?: string;
  limit?: number;
}

export interface SearchItemsParams {
  query: string;
  dietary?: string[];
  isAvailable?: boolean;
  restaurantId?: string;
  cursor?: string;
  limit?: number;
}

export interface NearbyParams {
  lat: number;
  lng: number;
  radiusMeters?: number;
  cuisineTypes?: CuisineType[];
  isOpenNow?: boolean;
  cursor?: string;
  limit?: number;
  /** Server-side intersection with the delivery zones covering `lat`/`lng`. */
  deliverableOnly?: boolean;
}

export interface ServiceabilityParams {
  lat: number;
  lng: number;
  subtotalAmount?: number;
  currency?: string;
}

/** server_2 `RestaurantRatingResponse` (`/restaurants/:id/rating`, review router). Returned raw — no adapter. */
export interface RestaurantRatingResponse {
  restaurantId: string;
  avgRating: number;
  reviewCount: number;
  distribution: Record<number, number>;
}

interface MoneyResponse {
  amount: number;
  currency: string;
}

/** server_2 `ServiceableRestaurantView`. */
export interface ServiceableRestaurantResponse {
  restaurantId: string;
  name: string;
  slug: string;
  distanceMeters: number;
  deliveryFee: MoneyResponse;
  minOrder: MoneyResponse;
}

export interface ServiceabilityViewModel {
  restaurantId: string;
  name: string;
  slug: string;
  distanceMeters: number;
  deliveryFee: Money;
  formattedDeliveryFee: string;
  minOrder: Money;
  formattedMinOrder: string;
}

function toMajorMoney(money: MoneyResponse): Money {
  return { amount: money.amount / 100, currency: money.currency };
}

function serviceabilityAdapter(dto: ServiceableRestaurantResponse): ServiceabilityViewModel {
  const deliveryFee = toMajorMoney(dto.deliveryFee);
  const minOrder = toMajorMoney(dto.minOrder);
  return {
    restaurantId: dto.restaurantId,
    name: dto.name,
    slug: dto.slug,
    distanceMeters: dto.distanceMeters,
    deliveryFee,
    formattedDeliveryFee: formatMoney(deliveryFee),
    minOrder,
    formattedMinOrder: formatMoney(minOrder),
  };
}

type QueryValue = string | number | boolean | string[] | undefined;

/** Builds a `?a=b&c=d` query string; CSV-encodes arrays; omits undefined/empty values. */
function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Catalog service — restaurant/menu discovery over the composed API client.
 * Mapping source: `my-app/integration_phases/Phase_4.md` (verified server_2
 * contracts). All query params are CSV-encoded/stringified in this layer —
 * `client.get` does not auto-build query strings.
 */
class CatalogService {
  private readonly http = client;

  /** GET /catalog/restaurants → normalizePage + restaurantAdapter. */
  async listRestaurants(
    params: RestaurantListParams = {},
  ): Promise<NormalizedPage<RestaurantViewModel>> {
    const qs = buildQuery({
      cursor: params.cursor,
      limit: params.limit,
      cuisineTypes: params.cuisineTypes,
      isOpen: params.isOpen,
      deliverableOnly: params.deliverableOnly,
      lat: params.lat,
      lng: params.lng,
    });
    const raw = await this.http.get<RawPage<RestaurantSummaryResponse>>(
      `/catalog/restaurants${qs}`,
    );
    const page = normalizePage(raw);
    return { ...page, items: page.items.map(restaurantAdapter) };
  }

  /** GET /catalog/restaurants/:id → restaurantAdapter. */
  async getRestaurant(id: string): Promise<RestaurantViewModel> {
    const dto = await this.http.get<RestaurantSummaryResponse>(`/catalog/restaurants/${id}`);
    return restaurantAdapter(dto);
  }

  /** GET /catalog/restaurants/:id/menu → menuAdapter. */
  async getMenu(restaurantId: string): Promise<MenuViewModel> {
    const dto = await this.http.get<RestaurantMenuResponse>(
      `/catalog/restaurants/${restaurantId}/menu`,
    );
    return menuAdapter(dto);
  }

  /**
   * GET /catalog/items/:id → `menuItemDetailAdapter`. The only read that carries
   * `variantGroups`; the variant picker calls it for the one item it opens.
   */
  async getItem(id: string): Promise<MenuItemDetailViewModel> {
    const dto = await this.http.get<MenuItemDetailResponse>(`/catalog/items/${id}`);
    return menuItemDetailAdapter(dto);
  }

  /** GET /catalog/search/restaurants → normalizePage + restaurantAdapter. */
  async searchRestaurants(
    params: SearchRestaurantsParams,
  ): Promise<NormalizedPage<RestaurantViewModel>> {
    const qs = buildQuery({
      q: params.query,
      cuisineTypes: params.cuisineTypes,
      isOpenNow: params.isOpenNow,
      cursor: params.cursor,
      limit: params.limit,
    });
    const raw = await this.http.get<RawPage<RestaurantSummaryResponse>>(
      `/catalog/search/restaurants${qs}`,
    );
    const page = normalizePage(raw);
    return { ...page, items: page.items.map(restaurantAdapter) };
  }

  /** GET /catalog/search/items → normalizePage + menuItemSearchAdapter. */
  async searchItems(
    params: SearchItemsParams,
  ): Promise<NormalizedPage<MenuItemSearchViewModel>> {
    const qs = buildQuery({
      q: params.query,
      dietary: params.dietary,
      isAvailable: params.isAvailable,
      restaurantId: params.restaurantId,
      cursor: params.cursor,
      limit: params.limit,
    });
    const raw = await this.http.get<RawPage<MenuItemSearchResponse>>(
      `/catalog/search/items${qs}`,
    );
    const page = normalizePage(raw);
    return { ...page, items: page.items.map(menuItemSearchAdapter) };
  }

  /** GET /catalog/nearby → normalizePage + restaurantAdapter. */
  async nearby(params: NearbyParams): Promise<NormalizedPage<RestaurantViewModel>> {
    const qs = buildQuery({
      lat: params.lat,
      lng: params.lng,
      radiusMeters: params.radiusMeters,
      cuisineTypes: params.cuisineTypes,
      isOpenNow: params.isOpenNow,
      cursor: params.cursor,
      limit: params.limit,
      deliverableOnly: params.deliverableOnly,
    });
    const raw = await this.http.get<RawPage<RestaurantSummaryResponse>>(
      `/catalog/nearby${qs}`,
    );
    const page = normalizePage(raw);
    return { ...page, items: page.items.map(restaurantAdapter) };
  }

  /** GET /catalog/serviceability → bare array (no paging); maps money to major units. */
  async serviceability(params: ServiceabilityParams): Promise<ServiceabilityViewModel[]> {
    const qs = buildQuery({
      lat: params.lat,
      lng: params.lng,
      subtotalAmount: params.subtotalAmount,
      currency: params.currency,
    });
    const dtos = await this.http.get<ServiceableRestaurantResponse[]>(
      `/catalog/serviceability${qs}`,
    );
    return dtos.map(serviceabilityAdapter);
  }

  /**
   * GET /catalog/deliverable → the ids of restaurants that deliver to a point.
   * The reachability half of serviceability, without the fee computation.
   */
  async deliverable(params: DeliverablePointParams): Promise<string[]> {
    const qs = buildQuery({ lat: params.lat, lng: params.lng });
    const dto = await this.http.get<DeliverableRestaurantsResponse>(`/catalog/deliverable${qs}`);
    return dto.restaurantIds;
  }

  /** GET /restaurants/:id/rating (review router, NOT /catalog) → raw shape. */
  async getRating(restaurantId: string): Promise<RestaurantRatingResponse> {
    return this.http.get<RestaurantRatingResponse>(`/restaurants/${restaurantId}/rating`);
  }
}

export const catalogService = new CatalogService();
