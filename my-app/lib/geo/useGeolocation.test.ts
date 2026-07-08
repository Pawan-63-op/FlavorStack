import { describe, expect, it } from "vitest";
import { mapGeolocationError } from "./useGeolocation";

describe("mapGeolocationError", () => {
  it("maps PERMISSION_DENIED (1) to denied", () => {
    const result = mapGeolocationError({ code: 1 });
    expect(result.status).toBe("denied");
    expect(result.message).toMatch(/permission denied/i);
  });

  it("maps POSITION_UNAVAILABLE (2) to unavailable", () => {
    const result = mapGeolocationError({ code: 2 });
    expect(result.status).toBe("unavailable");
    expect(result.message).toMatch(/unavailable/i);
  });

  it("maps TIMEOUT (3) to error with a retry hint", () => {
    const result = mapGeolocationError({ code: 3 });
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/timed out/i);
  });

  it("falls back to error for unknown codes, preferring the native message", () => {
    const result = mapGeolocationError({ code: 99, message: "weird failure" });
    expect(result.status).toBe("error");
    expect(result.message).toBe("weird failure");
  });

  it("uses a generic message when none is provided", () => {
    const result = mapGeolocationError({});
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/could not determine your location/i);
  });
});
