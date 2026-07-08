import { describe, expect, it } from "vitest";
import { normalizePage } from "./pagination";

describe("normalizePage", () => {
  it("normalizes a cursor page with more pages available", () => {
    expect(
      normalizePage({ items: [1, 2, 3], nextCursor: "abc" }),
    ).toEqual({
      items: [1, 2, 3],
      nextCursor: "abc",
      hasMore: true,
    });
  });

  it("normalizes a cursor page using the 'data' key", () => {
    expect(normalizePage({ data: [1, 2], nextCursor: "xyz" })).toEqual({
      items: [1, 2],
      nextCursor: "xyz",
      hasMore: true,
    });
  });

  it("normalizes a last cursor page (no nextCursor)", () => {
    expect(normalizePage({ items: [1, 2], nextCursor: null })).toEqual({
      items: [1, 2],
      nextCursor: undefined,
      hasMore: false,
    });
  });

  it("normalizes an empty cursor page", () => {
    expect(normalizePage({ items: [] })).toEqual({
      items: [],
      nextCursor: undefined,
      hasMore: false,
    });
  });

  it("normalizes an offset page with more pages available", () => {
    expect(
      normalizePage({ items: [1, 2], total: 10, limit: 2, offset: 0 }),
    ).toEqual({
      items: [1, 2],
      hasMore: true,
      total: 10,
    });
  });

  it("normalizes the last offset page", () => {
    expect(
      normalizePage({ items: [9, 10], total: 10, limit: 2, offset: 8 }),
    ).toEqual({
      items: [9, 10],
      hasMore: false,
      total: 10,
    });
  });

  it("normalizes an empty offset page", () => {
    expect(
      normalizePage({ items: [], total: 0, limit: 2, offset: 0 }),
    ).toEqual({
      items: [],
      hasMore: false,
      total: 0,
    });
  });

  it("normalizes a plain array", () => {
    expect(normalizePage([1, 2, 3])).toEqual({
      items: [1, 2, 3],
      hasMore: false,
      total: 3,
    });
  });

  it("normalizes an empty plain array", () => {
    expect(normalizePage([])).toEqual({
      items: [],
      hasMore: false,
      total: 0,
    });
  });

  it("normalizes null/undefined input to an empty page", () => {
    expect(normalizePage(null)).toEqual({ items: [], hasMore: false });
    expect(normalizePage(undefined)).toEqual({ items: [], hasMore: false });
  });

  it("normalizes an offset page missing its items array", () => {
    expect(
      normalizePage({ total: 0, limit: 2, offset: 0 } as never),
    ).toEqual({
      items: [],
      hasMore: false,
      total: 0,
    });
  });

  it("normalizes a bare cursor page with neither items, data, nor cursor", () => {
    expect(normalizePage({} as never)).toEqual({
      items: [],
      nextCursor: undefined,
      hasMore: false,
    });
  });
});
