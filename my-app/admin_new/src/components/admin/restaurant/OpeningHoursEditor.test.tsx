import { describe, expect, it } from "vitest";
import { addHoliday, removeHoliday, validateInterval } from "./OpeningHoursEditor";

describe("validateInterval", () => {
  it("rejects a malformed time", () => {
    expect(validateInterval("9am", "17:00")).not.toBeNull();
    expect(validateInterval("09:00", "5pm")).not.toBeNull();
  });

  it("rejects close <= open", () => {
    expect(validateInterval("17:00", "09:00")).not.toBeNull();
    expect(validateInterval("09:00", "09:00")).not.toBeNull();
  });

  it("accepts a valid open < close interval", () => {
    expect(validateInterval("09:00", "17:00")).toBeNull();
  });
});

describe("addHoliday", () => {
  it("appends a new date", () => {
    expect(addHoliday(["2026-01-01"], "2026-12-25")).toEqual(["2026-01-01", "2026-12-25"]);
  });

  it("does not add a duplicate date", () => {
    expect(addHoliday(["2026-01-01"], "2026-01-01")).toEqual(["2026-01-01"]);
  });
});

describe("removeHoliday", () => {
  it("removes the matching date", () => {
    expect(removeHoliday(["2026-01-01", "2026-12-25"], "2026-01-01")).toEqual(["2026-12-25"]);
  });

  it("is a no-op for a date not present", () => {
    expect(removeHoliday(["2026-01-01"], "2026-12-25")).toEqual(["2026-01-01"]);
  });
});
