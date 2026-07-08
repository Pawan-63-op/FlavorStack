import { describe, expect, it } from "vitest";
import { registerAdapter, type RegisterInput, type VehicleInput } from "./register";

function makeInput(overrides: Partial<RegisterInput> = {}): RegisterInput {
  return {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+15551234567",
    password: "Sup3r$ecret",
    ...overrides,
  };
}

function makeVehicle(overrides: Partial<VehicleInput> = {}): VehicleInput {
  return {
    type: "BIKE",
    brand: "Honda",
    model: "Activa",
    licensePlate: "KA01AB1234",
    rcDocumentUrl: "https://example.com/rc.pdf",
    insuranceUrl: "https://example.com/insurance.pdf",
    ...overrides,
  };
}

describe("registerAdapter", () => {
  it("emits a CUSTOMER role-discriminated payload", () => {
    const payload = registerAdapter(makeInput());

    expect(payload).toEqual({
      role: "CUSTOMER",
      customer: {
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+15551234567",
        password: "Sup3r$ecret",
      },
    });
  });

  it("defaults to CUSTOMER when role is omitted", () => {
    expect(registerAdapter(makeInput()).role).toBe("CUSTOMER");
  });

  it("passes through the exact field values given", () => {
    const payload = registerAdapter(makeInput({ name: "John Smith", email: "john@example.com" }));

    if (payload.role !== "CUSTOMER") throw new Error("expected CUSTOMER payload");
    expect(payload.customer.name).toBe("John Smith");
    expect(payload.customer.email).toBe("john@example.com");
  });

  it("does not include any stray fields on the customer object", () => {
    const payload = registerAdapter(makeInput());

    if (payload.role !== "CUSTOMER") throw new Error("expected CUSTOMER payload");
    expect(Object.keys(payload.customer).sort()).toEqual(
      ["email", "name", "password", "phone"].sort(),
    );
    expect(Object.keys(payload).sort()).toEqual(["customer", "role"].sort());
  });

  it("emits a DRIVER role-discriminated payload with the vehicle block", () => {
    const payload = registerAdapter(
      makeInput({ name: "Dora Driver", role: "DRIVER", vehicle: makeVehicle() }),
    );

    expect(payload).toEqual({
      role: "DRIVER",
      driver: {
        name: "Dora Driver",
        email: "jane@example.com",
        phone: "+15551234567",
        password: "Sup3r$ecret",
        vehicle: {
          type: "BIKE",
          brand: "Honda",
          model: "Activa",
          licensePlate: "KA01AB1234",
          rcDocumentUrl: "https://example.com/rc.pdf",
          insuranceUrl: "https://example.com/insurance.pdf",
        },
      },
    });
  });

  it("throws when registering as DRIVER without vehicle details", () => {
    expect(() => registerAdapter(makeInput({ role: "DRIVER" }))).toThrow(/vehicle/i);
  });
});
