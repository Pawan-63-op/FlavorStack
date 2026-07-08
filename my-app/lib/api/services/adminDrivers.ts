import { client } from "../client/http";

/**
 * Admin driver-onboarding service (Phase 14.3) — ADMIN-only "verify driver"
 * action over the composed API client, calling the new
 * `POST /admin/drivers/:id/verify` endpoint. Server-side it is guarded by
 * `requireRole(ADMIN)` + `requirePermission(USER, UPDATE)`; the UI additionally
 * hides the action behind `user.isAdmin` as a UX mitigation, not a security
 * control.
 *
 * The endpoint returns the resulting driver presence state (mirrors the
 * availability response), so a verified driver reads back as OFFLINE.
 */
export interface DriverVerificationResult {
  driverStatus: string;
  isAvailable: boolean;
  isOnline: boolean;
}

/** One driver row in the admin verification queue (GET /admin/drivers — G5). */
export interface AdminDriverSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  driverStatus: string;
  isVerified: boolean;
  vehicle: {
    type: string;
    brand: string;
    model: string;
    licensePlate: string;
  };
  createdAt: string;
}

interface ListDriversResponse {
  drivers: AdminDriverSummary[];
}

class AdminDriverService {
  /** Composed transport (single-flight 401→refresh applied). */
  private readonly http = client;

  /**
   * GET /admin/drivers[?status=…] — admin driver list (G5). Pass
   * `PENDING_VERIFICATION` to load the verify queue; omit `status` for all drivers.
   */
  async listDrivers(status?: string): Promise<AdminDriverSummary[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await this.http.get<ListDriversResponse>(`/admin/drivers${qs}`);
    return res.drivers;
  }

  /** POST /admin/drivers/:id/verify — PENDING_VERIFICATION|SUSPENDED → OFFLINE (no body). */
  async verifyDriver(driverId: string): Promise<DriverVerificationResult> {
    return this.http.post<DriverVerificationResult>(`/admin/drivers/${driverId}/verify`, {
      body: {},
    });
  }
}

export const adminDriverService = new AdminDriverService();
