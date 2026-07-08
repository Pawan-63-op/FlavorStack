import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAddressStore } from "./addressStore";
import { addressService } from "@/lib/api/services/address";
import type { Address } from "@/lib/address/types";

vi.mock("@/lib/api/services/address", () => ({
  addressService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    setDefault: vi.fn(),
  },
}));

function address(overrides: Partial<Address> = {}): Address {
  return {
    id: "a1",
    label: "Home",
    recipientName: "Jane Doe",
    phone: "+1 555 123 4567",
    addressLines: "221B Baker Street",
    city: "London",
    state: "Greater London",
    pinCode: "560038",
    lat: 51.5237,
    lng: -0.1585,
    isDefault: true,
    ...overrides,
  };
}

function input(overrides: Partial<Omit<Address, "id">> = {}): Omit<Address, "id"> {
  const { id: _id, ...rest } = address(overrides as Partial<Address>);
  return rest;
}

describe("addressStore (server-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAddressStore.setState({ addresses: [], hydrated: false, loading: false });
    localStorage.clear();
  });

  it("hydrate() fills the list from the service", async () => {
    vi.mocked(addressService.list).mockResolvedValue([address()]);

    await useAddressStore.getState().hydrate();

    expect(addressService.list).toHaveBeenCalledOnce();
    expect(useAddressStore.getState().addresses).toHaveLength(1);
    expect(useAddressStore.getState().hydrated).toBe(true);
  });

  it("hydrate() keeps the cached list when the service fails", async () => {
    useAddressStore.setState({ addresses: [address()] });
    vi.mocked(addressService.list).mockRejectedValue(new Error("offline"));

    await useAddressStore.getState().hydrate();

    expect(useAddressStore.getState().addresses).toHaveLength(1);
  });

  it("addAddress() persists via the service and adopts the returned list", async () => {
    vi.mocked(addressService.create).mockResolvedValue([address()]);

    await useAddressStore.getState().addAddress(input());

    expect(addressService.create).toHaveBeenCalledWith(input());
    expect(useAddressStore.getState().addresses).toHaveLength(1);
  });

  it("updateAddress() sends the id + payload and adopts the returned list", async () => {
    vi.mocked(addressService.update).mockResolvedValue([address({ city: "Mysore" })]);

    await useAddressStore.getState().updateAddress("a1", input({ city: "Mysore" }));

    expect(addressService.update).toHaveBeenCalledWith("a1", input({ city: "Mysore" }));
    expect(useAddressStore.getState().addresses[0].city).toBe("Mysore");
  });

  it("deleteAddress() adopts the remaining list from the service", async () => {
    useAddressStore.setState({ addresses: [address()] });
    vi.mocked(addressService.remove).mockResolvedValue([]);

    await useAddressStore.getState().deleteAddress("a1");

    expect(addressService.remove).toHaveBeenCalledWith("a1");
    expect(useAddressStore.getState().addresses).toHaveLength(0);
  });

  it("setDefault() adopts the server-flagged list", async () => {
    vi.mocked(addressService.setDefault).mockResolvedValue([
      address({ id: "a1", isDefault: false }),
      address({ id: "a2", isDefault: true }),
    ]);

    await useAddressStore.getState().setDefault("a2");

    expect(addressService.setDefault).toHaveBeenCalledWith("a2");
    expect(useAddressStore.getState().getDefault()?.id).toBe("a2");
  });

  it("clear() empties the cache (logout)", () => {
    useAddressStore.setState({ addresses: [address()], hydrated: true });

    useAddressStore.getState().clear();

    expect(useAddressStore.getState().addresses).toHaveLength(0);
    expect(useAddressStore.getState().hydrated).toBe(false);
  });

  it("persists addresses to localStorage as a cache", async () => {
    vi.mocked(addressService.create).mockResolvedValue([address()]);

    await useAddressStore.getState().addAddress(input());

    const raw = localStorage.getItem("address-book-storage");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.addresses).toHaveLength(1);
  });
});
