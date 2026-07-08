import { describe, expect, it } from "vitest";
import { toDeliveryAddress } from "./toDeliveryAddress";
import type { Address } from "./types";

function address(overrides: Partial<Address> = {}): Address {
  return {
    id: "a1",
    label: "Home",
    recipientName: "Jane Doe",
    phone: "+1 555 123 4567",
    addressLines: "221B Baker Street, Apt 4",
    city: "London",
    state: "Greater London",
    pinCode: "NW1 6XE",
    lat: 51.5237,
    lng: -0.1585,
    isDefault: true,
    ...overrides,
  };
}

describe("toDeliveryAddress", () => {
  it("maps the FE address to the server checkout shape", () => {
    const result = toDeliveryAddress(address());
    expect(result).toEqual({
      label: "Home",
      street: "221B Baker Street, Apt 4",
      city: "London",
      state: "Greater London",
      pinCode: "NW1 6XE",
      coordinates: { lat: 51.5237, lng: -0.1585 },
    });
  });

  it("omits label when not set", () => {
    const result = toDeliveryAddress(address({ label: "" }));
    expect(result).not.toHaveProperty("label");
  });

  it("drops FE-only fields (landmark, deliveryInstructions, isDefault, id)", () => {
    const result = toDeliveryAddress(
      address({ landmark: "Near the park", deliveryInstructions: "Ring twice" }),
    );
    expect(result).not.toHaveProperty("landmark");
    expect(result).not.toHaveProperty("deliveryInstructions");
    expect(result).not.toHaveProperty("isDefault");
    expect(result).not.toHaveProperty("id");
  });
});
