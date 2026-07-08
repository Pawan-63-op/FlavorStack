import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressResponse } from "../adapters/address";
import { client } from "../client/http";
import { addressService } from "./address";

vi.mock("../client/http", () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    raw: vi.fn(),
  },
}));

const dto = (over: Partial<AddressResponse> = {}): AddressResponse => ({
  id: "a1",
  label: "Home",
  recipientName: "Asha Rao",
  phone: "+919876543210",
  street: "100 Feet Road",
  city: "Bangalore",
  state: "Karnataka",
  pinCode: "560038",
  coordinates: { lat: 12.97, lng: 77.59 },
  isDefault: true,
  ...over,
});

const body = {
  label: "Home",
  recipientName: "Asha Rao",
  phone: "+919876543210",
  addressLines: "100 Feet Road",
  city: "Bangalore",
  state: "Karnataka",
  pinCode: "560038",
  lat: 12.97,
  lng: 77.59,
  isDefault: true,
};

describe("addressService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list() GETs /users/me/addresses and maps to FE addresses", async () => {
    vi.mocked(client.get).mockResolvedValue([dto()]);

    const result = await addressService.list();

    expect(client.get).toHaveBeenCalledWith("/users/me/addresses");
    expect(result[0].addressLines).toBe("100 Feet Road");
    expect(result[0].lat).toBe(12.97);
  });

  it("create() POSTs the mapped body and returns the list", async () => {
    vi.mocked(client.post).mockResolvedValue([dto()]);

    const result = await addressService.create(body);

    expect(client.post).toHaveBeenCalledWith("/users/me/addresses", {
      body: expect.objectContaining({ street: "100 Feet Road", lat: 12.97 }),
    });
    expect(result).toHaveLength(1);
  });

  it("update() PATCHes /users/me/addresses/:id", async () => {
    vi.mocked(client.patch).mockResolvedValue([dto()]);

    await addressService.update("a1", body);

    expect(client.patch).toHaveBeenCalledWith("/users/me/addresses/a1", {
      body: expect.objectContaining({ street: "100 Feet Road" }),
    });
  });

  it("remove() DELETEs /users/me/addresses/:id", async () => {
    vi.mocked(client.del).mockResolvedValue([]);

    const result = await addressService.remove("a1");

    expect(client.del).toHaveBeenCalledWith("/users/me/addresses/a1");
    expect(result).toEqual([]);
  });

  it("setDefault() PATCHes /users/me/addresses/:id/default", async () => {
    vi.mocked(client.patch).mockResolvedValue([dto()]);

    await addressService.setDefault("a1");

    expect(client.patch).toHaveBeenCalledWith("/users/me/addresses/a1/default", { body: {} });
  });
});
