import { describe, expect, it } from "vitest";
import { parsePolygonLines, validatePolygon } from "./DeliveryZoneEditor";

describe("parsePolygonLines", () => {
  it("parses comma-separated lat,lng lines", () => {
    expect(parsePolygonLines("18.5,73.8\n18.6,73.9\n18.7,73.7")).toEqual([
      { lat: 18.5, lng: 73.8 },
      { lat: 18.6, lng: 73.9 },
      { lat: 18.7, lng: 73.7 },
    ]);
  });

  it("ignores blank lines", () => {
    expect(parsePolygonLines("18.5,73.8\n\n18.6,73.9")).toEqual([
      { lat: 18.5, lng: 73.8 },
      { lat: 18.6, lng: 73.9 },
    ]);
  });

  it("returns null for a malformed line", () => {
    expect(parsePolygonLines("18.5,73.8\nnot-a-point")).toBeNull();
  });
});

describe("validatePolygon", () => {
  it("requires at least 3 points", () => {
    expect(
      validatePolygon([
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
      ]),
    ).not.toBeNull();
  });

  it("rejects an out-of-range point", () => {
    expect(
      validatePolygon([
        { lat: 91, lng: 1 },
        { lat: 2, lng: 2 },
        { lat: 3, lng: 3 },
      ]),
    ).not.toBeNull();
  });

  it("accepts 3 or more valid points", () => {
    expect(
      validatePolygon([
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
        { lat: 3, lng: 3 },
      ]),
    ).toBeNull();
  });
});
