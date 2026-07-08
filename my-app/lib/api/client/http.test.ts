import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, rawRequest, request } from "./http";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

describe("http client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefixes the base URL onto the path", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await request("GET", "/catalog/restaurants");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/catalog/restaurants");
  });

  it("sends credentials: 'include' on every request", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await request("GET", "/catalog/restaurants");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe("include");
  });

  it("propagates custom headers alongside a generated x-request-id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await request("GET", "/catalog/restaurants", {
      headers: { Authorization: "Bearer test" },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer test");
    expect(typeof init.headers["x-request-id"]).toBe("string");
    expect(init.headers["x-request-id"].length).toBeGreaterThan(0);
  });

  it("generates a unique x-request-id per request", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ ok: true }));

    await request("GET", "/catalog/restaurants");
    await request("GET", "/catalog/restaurants");

    const id1 = fetchMock.mock.calls[0][1].headers["x-request-id"];
    const id2 = fetchMock.mock.calls[1][1].headers["x-request-id"];
    expect(id1).not.toBe(id2);
  });

  it("JSON-encodes the body and sets Content-Type for JSON requests", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await request("POST", "/cart/items", { body: { itemId: "abc", qty: 2 } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ itemId: "abc", qty: 2 }));
  });

  it("returns parsed JSON for a 2xx response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "1", name: "Pizza" }));

    const result = await request<{ id: string; name: string }>(
      "GET",
      "/catalog/restaurants/1",
    );

    expect(result).toEqual({ id: "1", name: "Pizza" });
  });

  it("returns undefined for a 204 response", async () => {
    fetchMock.mockResolvedValue(emptyResponse(204));

    const result = await request("POST", "/auth/logout");

    expect(result).toBeUndefined();
  });

  it("throws a normalized ApiError for a non-2xx response", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: "NOT_FOUND", message: "Not found", requestId: "req-1" } },
        404,
      ),
    );

    await expect(request("GET", "/catalog/restaurants/missing")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      category: "notFound",
    });
  });

  it("throws a normalized network ApiError when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(request("GET", "/catalog/restaurants")).rejects.toMatchObject({
      category: "network",
      code: "NETWORK_ERROR",
    });
  });

  describe("client method helpers", () => {
    it("client.get issues a GET request", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
      await client.get("/catalog/restaurants");
      expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    });

    it("client.post issues a POST request", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
      await client.post("/cart/items", { body: { itemId: "a" } });
      expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    });

    it("client.patch issues a PATCH request", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
      await client.patch("/users/me", { body: { name: "x" } });
      expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    });

    it("client.put issues a PUT request", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
      await client.put("/cart/items/1", { body: { qty: 3 } });
      expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    });

    it("client.del issues a DELETE request", async () => {
      fetchMock.mockResolvedValue(emptyResponse(204));
      await client.del("/cart/items/1");
      expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    });
  });

  describe("raw binary requests", () => {
    it("sends the provided content type and passes the body through unchanged", async () => {
      fetchMock.mockResolvedValue(emptyResponse(204));
      const blob = new Blob(["fake-image-bytes"], { type: "image/png" });

      await rawRequest("POST", "/catalog/restaurants/1/image", {
        body: blob,
        contentType: "image/png",
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v1/catalog/restaurants/1/image");
      expect(init.headers["Content-Type"]).toBe("image/png");
      expect(init.body).toBe(blob);
      expect(init.credentials).toBe("include");
    });

    it("rejects a binary body over the 5 MB limit without calling fetch", async () => {
      const oversized = new Uint8Array(5 * 1024 * 1024 + 1);

      await expect(
        rawRequest("POST", "/catalog/restaurants/1/image", {
          body: oversized,
          contentType: "image/png",
        }),
      ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("client.raw issues a raw binary request", async () => {
      fetchMock.mockResolvedValue(emptyResponse(204));
      const blob = new Blob(["bytes"], { type: "image/jpeg" });

      await client.raw("POST", "/catalog/restaurants/1/image", {
        body: blob,
        contentType: "image/jpeg",
      });

      expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBe(
        "image/jpeg",
      );
    });
  });
});
