import { describe, expect, it } from "vitest";
import { addressResponseAdapter, toAddressBody, type AddressResponse } from "./address";
import type { Address } from "@/lib/address/types";

const serverAddress = (over: Partial<AddressResponse> = {}): AddressResponse => ({
  id: "a1",
  label: "Home",
  recipientName: "Asha Rao",
  phone: "+919876543210",
  street: "100 Feet Road",
  city: "Bangalore",
  state: "Karnataka",
  pinCode: "560038",
  landmark: "Near metro",
  deliveryInstructions: "Ring twice",
  coordinates: { lat: 12.97, lng: 77.59 },
  isDefault: true,
  ...over,
});

describe("addressResponseAdapter", () => {
  it("maps server street→addressLines and coordinates→lat/lng", () => {
    const result = addressResponseAdapter(serverAddress());

    expect(result).toEqual<Address>({
      id: "a1",
      label: "Home",
      recipientName: "Asha Rao",
      phone: "+919876543210",
      addressLines: "100 Feet Road",
      city: "Bangalore",
      state: "Karnataka",
      pinCode: "560038",
      landmark: "Near metro",
      deliveryInstructions: "Ring twice",
      lat: 12.97,
      lng: 77.59,
      isDefault: true,
    });
  });

  it("defaults the optional contact fields to empty strings when absent", () => {
    const result = addressResponseAdapter(
      serverAddress({ recipientName: undefined, phone: undefined, label: undefined }),
    );

    expect(result.recipientName).toBe("");
    expect(result.phone).toBe("");
    expect(result.label).toBe("Home");
  });
});

describe("toAddressBody", () => {
  it("maps FE addressLines→street and flattens coordinates", () => {
    const input: Omit<Address, "id"> = {
      label: "Work",
      recipientName: "Asha Rao",
      phone: "+919876543210",
      addressLines: "200 Ring Road",
      city: "Mysore",
      state: "Karnataka",
      pinCode: "570001",
      landmark: "Behind the mall",
      deliveryInstructions: "Call on arrival",
      lat: 12.3,
      lng: 76.6,
      isDefault: false,
    };

    expect(toAddressBody(input)).toEqual({
      label: "Work",
      recipientName: "Asha Rao",
      phone: "+919876543210",
      street: "200 Ring Road",
      city: "Mysore",
      state: "Karnataka",
      pinCode: "570001",
      landmark: "Behind the mall",
      deliveryInstructions: "Call on arrival",
      lat: 12.3,
      lng: 76.6,
      isDefault: false,
    });
  });
});
