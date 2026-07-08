import { client } from "../client/http";
import {
  ownerRestaurantAdapter,
  toAddCategoryBody,
  toCreateRestaurantBody,
  toManageZoneBody,
  toOpeningHoursBody,
  toUpdateCategoryBody,
  toUpdateRestaurantBody,
  type CatalogVisibility,
  type CategoryFormValues,
  type ManageZoneInput,
  type OpeningHoursInput,
  type OwnerRestaurantResponse,
  type OwnerRestaurantView,
  type RestaurantFormValues,
  type UpdateCategoryInput,
  type UpdateRestaurantInput,
} from "../adapters/restaurantOwner";
import {
  ownerMenuItemAdapter,
  toAddMenuItemBody,
  toAvailabilityBody,
  toSetVariantsBody,
  toUpdateMenuItemBody,
  type AvailabilityInput,
  type MenuItemFormValues,
  type OwnerMenuItemResponse,
  type OwnerMenuItemView,
  type UpdateMenuItemInput,
  type VariantGroupInput,
} from "../adapters/menuOwner";

/**
 * Catalog **owner-write** service — the full owner surface over the composed
 * API client. Mapping source: `my-app/integration_phases/Phase-10.md` →
 * Batch 10.0 (binding contract).
 *
 * Pure HTTP + adapter (no cache/registry side-effects — those live in the
 * `useOwnerCatalog` hooks, mirroring `cartService`/`useCart`). Every write
 * returns the FULL adapted view-model; category writes return the parent
 * restaurant; deletes resolve `void` (204). 409 conflicts surface as `ApiError`
 * for the hook layer to refetch-and-retry (Batch 10.0 §8).
 */
class CatalogOwnerService {
  private readonly http = client;


  /** POST /catalog/restaurants → 201. */
  async createRestaurant(form: RestaurantFormValues): Promise<OwnerRestaurantView> {
    const dto = await this.http.post<OwnerRestaurantResponse>("/catalog/restaurants", {
      body: toCreateRestaurantBody(form),
    });
    return ownerRestaurantAdapter(dto);
  }

  /**
   * GET /catalog/restaurants/mine → the signed-in owner's restaurants as full
   * owner views (server-truth ownership). Authoritative source for the registry
   * cache; an owner with none yields `[]`.
   */
  async listOwnerRestaurants(): Promise<OwnerRestaurantView[]> {
    const page = await this.http.get<{ items: OwnerRestaurantResponse[] }>(
      "/catalog/restaurants/mine",
    );
    return page.items.map(ownerRestaurantAdapter);
  }

  /** PATCH /catalog/restaurants/:id (≥1 field). */
  async updateRestaurant(
    id: string,
    input: UpdateRestaurantInput,
  ): Promise<OwnerRestaurantView> {
    const dto = await this.http.patch<OwnerRestaurantResponse>(`/catalog/restaurants/${id}`, {
      body: toUpdateRestaurantBody(input),
    });
    return ownerRestaurantAdapter(dto);
  }

  /** DELETE /catalog/restaurants/:id → 204. */
  async deleteRestaurant(id: string): Promise<void> {
    await this.http.del<void>(`/catalog/restaurants/${id}`);
  }

  /** POST /catalog/restaurants/:id/publish (requires ≥1 active category → else 422). */
  async publish(id: string): Promise<OwnerRestaurantView> {
    return this.lifecycle(id, "publish");
  }

  async pause(id: string): Promise<OwnerRestaurantView> {
    return this.lifecycle(id, "pause");
  }

  async close(id: string): Promise<OwnerRestaurantView> {
    return this.lifecycle(id, "close");
  }

  private async lifecycle(
    id: string,
    action: "publish" | "pause" | "close",
  ): Promise<OwnerRestaurantView> {
    const dto = await this.http.post<OwnerRestaurantResponse>(
      `/catalog/restaurants/${id}/${action}`,
    );
    return ownerRestaurantAdapter(dto);
  }

  /** PATCH /catalog/restaurants/:id/visibility. */
  async setVisibility(
    id: string,
    visibility: CatalogVisibility,
  ): Promise<OwnerRestaurantView> {
    const dto = await this.http.patch<OwnerRestaurantResponse>(
      `/catalog/restaurants/${id}/visibility`,
      { body: { visibility } },
    );
    return ownerRestaurantAdapter(dto);
  }

  /** PUT /catalog/restaurants/:id/opening-hours. */
  async setOpeningHours(
    id: string,
    input: OpeningHoursInput,
  ): Promise<OwnerRestaurantView> {
    const dto = await this.http.put<OwnerRestaurantResponse>(
      `/catalog/restaurants/${id}/opening-hours`,
      { body: toOpeningHoursBody(input) },
    );
    return ownerRestaurantAdapter(dto);
  }

  /** POST /catalog/restaurants/:id/image — raw binary, ≤5 MB (client enforces the cap). */
  async uploadRestaurantImage(
    id: string,
    file: Blob,
    contentType?: string,
  ): Promise<OwnerRestaurantView> {
    const dto = await this.http.raw<OwnerRestaurantResponse>(
      "POST",
      `/catalog/restaurants/${id}/image`,
      { body: file, contentType: contentType ?? file.type ?? "application/octet-stream" },
    );
    return ownerRestaurantAdapter(dto);
  }


  /** POST /catalog/restaurants/:id/categories → 201. */
  async addCategory(
    id: string,
    form: CategoryFormValues,
  ): Promise<OwnerRestaurantView> {
    const dto = await this.http.post<OwnerRestaurantResponse>(
      `/catalog/restaurants/${id}/categories`,
      { body: toAddCategoryBody(form) },
    );
    return ownerRestaurantAdapter(dto);
  }

  /** POST /catalog/restaurants/:id/categories/reorder. */
  async reorderCategories(
    id: string,
    orderedCategoryIds: string[],
  ): Promise<OwnerRestaurantView> {
    const dto = await this.http.post<OwnerRestaurantResponse>(
      `/catalog/restaurants/${id}/categories/reorder`,
      { body: { orderedCategoryIds } },
    );
    return ownerRestaurantAdapter(dto);
  }

  /** PATCH /catalog/restaurants/:id/categories/:categoryId. */
  async updateCategory(
    id: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<OwnerRestaurantView> {
    const dto = await this.http.patch<OwnerRestaurantResponse>(
      `/catalog/restaurants/${id}/categories/${categoryId}`,
      { body: toUpdateCategoryBody(input) },
    );
    return ownerRestaurantAdapter(dto);
  }

  /** DELETE /catalog/restaurants/:id/categories/:categoryId → 200 RestaurantResponse. */
  async removeCategory(id: string, categoryId: string): Promise<OwnerRestaurantView> {
    const dto = await this.http.del<OwnerRestaurantResponse>(
      `/catalog/restaurants/${id}/categories/${categoryId}`,
    );
    return ownerRestaurantAdapter(dto);
  }


  /** POST /catalog/restaurants/:id/zones. */
  async manageZone(id: string, input: ManageZoneInput): Promise<OwnerRestaurantView> {
    const dto = await this.http.post<OwnerRestaurantResponse>(
      `/catalog/restaurants/${id}/zones`,
      { body: toManageZoneBody(input) },
    );
    return ownerRestaurantAdapter(dto);
  }


  /** POST /catalog/restaurants/:id/items → 201 (body carries `basePrice`). */
  async addItem(
    restaurantId: string,
    form: MenuItemFormValues,
  ): Promise<OwnerMenuItemView> {
    const dto = await this.http.post<OwnerMenuItemResponse>(
      `/catalog/restaurants/${restaurantId}/items`,
      { body: toAddMenuItemBody(form) },
    );
    return ownerMenuItemAdapter(dto);
  }

  /** PATCH /catalog/items/:id (body carries `price`, NOT `basePrice`). */
  async updateItem(itemId: string, input: UpdateMenuItemInput): Promise<OwnerMenuItemView> {
    const dto = await this.http.patch<OwnerMenuItemResponse>(`/catalog/items/${itemId}`, {
      body: toUpdateMenuItemBody(input),
    });
    return ownerMenuItemAdapter(dto);
  }

  /** DELETE /catalog/items/:id → 204. */
  async removeItem(itemId: string): Promise<void> {
    await this.http.del<void>(`/catalog/items/${itemId}`);
  }

  /** PATCH /catalog/items/:id/availability. */
  async setAvailability(
    itemId: string,
    input: AvailabilityInput,
  ): Promise<OwnerMenuItemView> {
    const dto = await this.http.patch<OwnerMenuItemResponse>(
      `/catalog/items/${itemId}/availability`,
      { body: toAvailabilityBody(input) },
    );
    return ownerMenuItemAdapter(dto);
  }

  /** PUT /catalog/items/:id/variants. */
  async setVariants(
    itemId: string,
    groups: VariantGroupInput[],
  ): Promise<OwnerMenuItemView> {
    const dto = await this.http.put<OwnerMenuItemResponse>(
      `/catalog/items/${itemId}/variants`,
      { body: toSetVariantsBody(groups) },
    );
    return ownerMenuItemAdapter(dto);
  }

  /** POST /catalog/items/:id/image — raw binary, ≤5 MB (client enforces the cap). */
  async uploadItemImage(
    itemId: string,
    file: Blob,
    contentType?: string,
  ): Promise<OwnerMenuItemView> {
    const dto = await this.http.raw<OwnerMenuItemResponse>(
      "POST",
      `/catalog/items/${itemId}/image`,
      { body: file, contentType: contentType ?? file.type ?? "application/octet-stream" },
    );
    return ownerMenuItemAdapter(dto);
  }
}

export const catalogOwnerService = new CatalogOwnerService();
