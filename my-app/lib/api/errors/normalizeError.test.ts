import { describe, expect, it } from "vitest";
import { normalizeError } from "./normalizeError";

describe("normalizeError — server envelope fixtures", () => {
  it("maps invalid_token (401) to the auth category", () => {
    const error = normalizeError(401, {
      error: {
        code: "FORBIDDEN",
        message: "invalid_token",
        requestId: "req-1",
      },
    });

    expect(error.status).toBe(401);
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("invalid_token");
    expect(error.requestId).toBe("req-1");
    expect(error.category).toBe("auth");
  });

  it("maps invalid_credentials (401) to the auth category", () => {
    const error = normalizeError(401, {
      error: {
        code: "NOT_FOUND",
        message: "invalid_credentials",
        requestId: "req-2",
      },
    });

    expect(error.status).toBe(401);
    expect(error.category).toBe("auth");
  });

  it("maps a VALIDATION_ERROR (422) to validation with fieldErrors", () => {
    const error = normalizeError(422, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: [
          { path: "email", message: "Invalid email" },
          { path: "password", message: "Too short" },
        ],
        requestId: "req-3",
      },
    });

    expect(error.category).toBe("validation");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.fieldErrors).toEqual({
      email: "Invalid email",
      password: "Too short",
    });
  });

  it("maps NOT_FOUND (404) to the notFound category", () => {
    const error = normalizeError(404, {
      error: { code: "NOT_FOUND", message: "Restaurant not found", requestId: "req-4" },
    });

    expect(error.category).toBe("notFound");
  });

  it("maps CONFLICT (409) to the conflict category", () => {
    const error = normalizeError(409, {
      error: { code: "CONFLICT", message: "Already exists", requestId: "req-5" },
    });

    expect(error.category).toBe("conflict");
  });

  it("maps FORBIDDEN (403) to the forbidden category", () => {
    const error = normalizeError(403, {
      error: { code: "FORBIDDEN", message: "Not allowed", requestId: "req-6" },
    });

    expect(error.category).toBe("forbidden");
  });

  it("maps RATE_LIMIT_EXCEEDED (429) to the rateLimit category", () => {
    const error = normalizeError(429, {
      error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests", requestId: "req-7" },
    });

    expect(error.category).toBe("rateLimit");
  });

  it("maps a 500 INTERNAL_ERROR to the server category", () => {
    const error = normalizeError(500, {
      error: { code: "INTERNAL_ERROR", message: "Internal server error", requestId: "req-8" },
    });

    expect(error.category).toBe("server");
  });
});

describe("normalizeError — defensive body parsing", () => {
  it("tolerates a bare { message } body", () => {
    const error = normalizeError(400, { message: "Something went wrong" });

    expect(error.status).toBe(400);
    expect(error.message).toBe("Something went wrong");
    expect(error.code).toBe("UNKNOWN_ERROR");
  });

  it("does not throw on an empty 204 body", () => {
    expect(() => normalizeError(204, undefined)).not.toThrow();
    const error = normalizeError(204, undefined);
    expect(error.status).toBe(204);
    expect(error.code).toBe("UNKNOWN_ERROR");
  });

  it("does not throw on a non-JSON (string) body", () => {
    expect(() => normalizeError(502, "<html>Bad Gateway</html>")).not.toThrow();
    const error = normalizeError(502, "<html>Bad Gateway</html>");
    expect(error.category).toBe("server");
    expect(error.message).toBe("Request failed with status 502");
  });

  it("does not throw on a null body", () => {
    expect(() => normalizeError(500, null)).not.toThrow();
  });

  it("ignores malformed details that aren't an array of {path,message}", () => {
    const error = normalizeError(422, {
      error: { code: "VALIDATION_ERROR", message: "Validation failed", details: "oops" },
    });

    expect(error.fieldErrors).toBeUndefined();
  });
});

describe("normalizeError — requestId from x-request-id header", () => {
  it("falls back to the x-request-id response header when the body omits requestId", () => {
    const headers = new Headers({ "x-request-id": "hdr-req-9" });

    const error = normalizeError(
      500,
      { error: { code: "INTERNAL_ERROR", message: "boom" } },
      headers,
    );

    expect(error.requestId).toBe("hdr-req-9");
  });

  it("prefers the body requestId over the header when both are present", () => {
    const headers = new Headers({ "x-request-id": "hdr-req-10" });

    const error = normalizeError(
      404,
      { error: { code: "NOT_FOUND", message: "missing", requestId: "body-req-10" } },
      headers,
    );

    expect(error.requestId).toBe("body-req-10");
  });

  it("captures requestId from the header even when the body is non-JSON", () => {
    const headers = new Headers({ "x-request-id": "hdr-req-11" });

    const error = normalizeError(502, "<html>Bad Gateway</html>", headers);

    expect(error.requestId).toBe("hdr-req-11");
  });
});

describe("normalizeError — network failures", () => {
  it("maps a thrown network error to the network category", () => {
    const error = normalizeError(new TypeError("Failed to fetch"));

    expect(error.status).toBeUndefined();
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toBe("Failed to fetch");
    expect(error.category).toBe("network");
  });

  it("handles a non-Error network rejection", () => {
    const error = normalizeError("connection reset");

    expect(error.category).toBe("network");
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toBe("Network error");
  });
});
