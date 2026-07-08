/** FE register form → server_2 `role`-discriminated `POST /auth/register` payload. */

/** Driver vehicle/KYC details — mirrors server_2 `registerDriverSchema.vehicle`. */
export interface VehicleInput {
  type: string;
  brand: string;
  model: string;
  licensePlate: string;
  rcDocumentUrl: string;
  insuranceUrl: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  /** Onboarding role (Phase 1 / G4). Defaults to CUSTOMER when omitted. */
  role?: "CUSTOMER" | "DRIVER";
  /** Required when `role === "DRIVER"`. */
  vehicle?: VehicleInput;
}

/** Discriminated body accepted by server_2 `registerSchema`. */
export type RegisterPayload =
  | {
      role: "CUSTOMER";
      customer: { name: string; email: string; phone: string; password: string };
    }
  | {
      role: "DRIVER";
      driver: {
        name: string;
        email: string;
        phone: string;
        password: string;
        vehicle: VehicleInput;
      };
    };

export function registerAdapter(input: RegisterInput): RegisterPayload {
  if (input.role === "DRIVER") {
    if (!input.vehicle) {
      throw new Error("Vehicle details are required to register as a driver");
    }
    return {
      role: "DRIVER",
      driver: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        password: input.password,
        vehicle: {
          type: input.vehicle.type,
          brand: input.vehicle.brand,
          model: input.vehicle.model,
          licensePlate: input.vehicle.licensePlate,
          rcDocumentUrl: input.vehicle.rcDocumentUrl,
          insuranceUrl: input.vehicle.insuranceUrl,
        },
      },
    };
  }

  return {
    role: "CUSTOMER",
    customer: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      password: input.password,
    },
  };
}
