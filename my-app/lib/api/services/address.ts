import { client } from "../client/http";
import {
  addressResponseAdapter,
  toAddressBody,
  type AddressResponse,
} from "../adapters/address";
import type { Address } from "@/lib/address/types";

/**
 * Self-service delivery address service (Phase 15 / G12) — server-truth address
 * book so checkout works on a fresh browser/device. Every mutation returns the
 * full updated list (the server flags the default), which the address store uses
 * to reconcile its localStorage cache. Endpoints are CUSTOMER-gated server-side.
 */
class AddressService {
  private readonly http = client;

  /** GET /users/me/addresses → the signed-in customer's saved addresses. */
  async list(): Promise<Address[]> {
    const dtos = await this.http.get<AddressResponse[]>("/users/me/addresses");
    return dtos.map(addressResponseAdapter);
  }

  /** POST /users/me/addresses → 201 with the updated list. */
  async create(input: Omit<Address, "id">): Promise<Address[]> {
    const dtos = await this.http.post<AddressResponse[]>("/users/me/addresses", {
      body: toAddressBody(input),
    });
    return dtos.map(addressResponseAdapter);
  }

  /** PATCH /users/me/addresses/:id → updated list. */
  async update(id: string, input: Omit<Address, "id">): Promise<Address[]> {
    const dtos = await this.http.patch<AddressResponse[]>(`/users/me/addresses/${id}`, {
      body: toAddressBody(input),
    });
    return dtos.map(addressResponseAdapter);
  }

  /** DELETE /users/me/addresses/:id → remaining list. */
  async remove(id: string): Promise<Address[]> {
    const dtos = await this.http.del<AddressResponse[]>(`/users/me/addresses/${id}`);
    return dtos.map(addressResponseAdapter);
  }

  /** PATCH /users/me/addresses/:id/default → updated list. */
  async setDefault(id: string): Promise<Address[]> {
    const dtos = await this.http.patch<AddressResponse[]>(`/users/me/addresses/${id}/default`, {
      body: {},
    });
    return dtos.map(addressResponseAdapter);
  }
}

export const addressService = new AddressService();
