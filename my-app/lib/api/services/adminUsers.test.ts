import { beforeEach, describe, expect, it, vi } from "vitest";
import { client } from "../client/http";
import { adminUserService } from "./adminUsers";

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

describe("adminUserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listUsers", () => {
    it("GETs /admin/users with no params", async () => {
      vi.mocked(client.get).mockResolvedValue({ users: [], total: 0, limit: 10, offset: 0 });

      await adminUserService.listUsers();

      expect(client.get).toHaveBeenCalledWith("/admin/users");
    });

    it("builds a query string from page/limit/role/search (search trimmed)", async () => {
      vi.mocked(client.get).mockResolvedValue({ users: [], total: 0, limit: 10, offset: 0 });

      await adminUserService.listUsers({ page: 2, limit: 10, role: "DRIVER", search: "  jane " });

      expect(client.get).toHaveBeenCalledWith(
        "/admin/users?page=2&limit=10&role=DRIVER&search=jane",
      );
    });
  });

  describe("moderation", () => {
    it("POSTs role change", async () => {
      vi.mocked(client.post).mockResolvedValue(undefined);
      await adminUserService.assignRole("u-1", "ADMIN");
      expect(client.post).toHaveBeenCalledWith("/admin/users/u-1/role", { body: { role: "ADMIN" } });
    });

    it("POSTs ban with reason", async () => {
      vi.mocked(client.post).mockResolvedValue(undefined);
      await adminUserService.banUser("u-1", "spam");
      expect(client.post).toHaveBeenCalledWith("/admin/users/u-1/ban", { body: { reason: "spam" } });
    });

    it("POSTs unban", async () => {
      vi.mocked(client.post).mockResolvedValue(undefined);
      await adminUserService.unbanUser("u-1");
      expect(client.post).toHaveBeenCalledWith("/admin/users/u-1/unban", { body: {} });
    });
  });
});
