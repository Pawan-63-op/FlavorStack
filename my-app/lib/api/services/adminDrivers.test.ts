import { beforeEach, describe, expect, it, vi } from "vitest";
import { client } from "../client/http";
import { adminDriverService } from "./adminDrivers";

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

describe("adminDriverService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listDrivers", () => {
    it("GETs /admin/drivers with no query and unwraps the drivers array", async () => {
      vi.mocked(client.get).mockResolvedValue({ drivers: [{ id: "drv-1" }] });

      const result = await adminDriverService.listDrivers();

      expect(client.get).toHaveBeenCalledWith("/admin/drivers");
      expect(result).toEqual([{ id: "drv-1" }]);
    });

    it("appends an encoded ?status= filter when provided", async () => {
      vi.mocked(client.get).mockResolvedValue({ drivers: [] });

      await adminDriverService.listDrivers("PENDING_VERIFICATION");

      expect(client.get).toHaveBeenCalledWith("/admin/drivers?status=PENDING_VERIFICATION");
    });
  });

  describe("verifyDriver", () => {
    it("POSTs to /admin/drivers/:id/verify with an empty body and returns the driver state", async () => {
      vi.mocked(client.post).mockResolvedValue({
        driverStatus: "OFFLINE",
        isAvailable: false,
        isOnline: false,
      });

      const result = await adminDriverService.verifyDriver("drv-1");

      expect(client.post).toHaveBeenCalledWith("/admin/drivers/drv-1/verify", { body: {} });
      expect(result).toEqual({ driverStatus: "OFFLINE", isAvailable: false, isOnline: false });
    });
  });
});
