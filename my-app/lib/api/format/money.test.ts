import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats a USD amount", () => {
    expect(formatMoney({ amount: 12.5, currency: "USD" })).toBe("$12.50");
  });

  it("formats a currency-aware amount for a non-USD currency", () => {
    expect(formatMoney({ amount: 9.99, currency: "EUR" }, "en-US")).toBe(
      "€9.99",
    );
  });

  it("formats zero without treating it as missing", () => {
    expect(formatMoney({ amount: 0, currency: "USD" })).toBe("$0.00");
  });

  it("returns a fallback when amount is null", () => {
    expect(formatMoney({ amount: null, currency: "USD" })).toBe("—");
  });

  it("returns a fallback when amount is undefined", () => {
    expect(formatMoney({ amount: undefined, currency: "USD" })).toBe("—");
  });

  it("returns a fallback when money is null", () => {
    expect(formatMoney(null)).toBe("—");
  });

  it("returns a fallback when money is undefined", () => {
    expect(formatMoney(undefined)).toBe("—");
  });

  it("defaults to USD when currency is missing", () => {
    expect(formatMoney({ amount: 5, currency: null })).toBe("$5.00");
  });

  it("falls back to a manual format for an invalid currency code", () => {
    expect(formatMoney({ amount: 5, currency: "NOTACODE" })).toBe(
      "NOTACODE 5.00",
    );
  });
});
