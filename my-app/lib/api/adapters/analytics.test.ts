import { describe, expect, it } from "vitest";
import { analyticsAdapter, type DashboardAnalyticsResponse } from "./analytics";

function makeResponse(overrides: Partial<DashboardAnalyticsResponse> = {}): DashboardAnalyticsResponse {
  return {
    scope: "PLATFORM",
    windowDays: 30,
    currency: "INR",
    cards: {
      revenue: { amount: 150000, currency: "INR" },
      totalOrders: 10,
      activeOrders: 2,
      avgOrderValue: { amount: 25000, currency: "INR" },
      delivered: 6,
      cancelled: 2,
      restaurantCount: 3,
      revenueTrendPct: 12.5,
      ordersTrendPct: -8.2,
    },
    statusBreakdown: {
      DELIVERED: 6,
      CANCELLED: 2,
      PREPARING: 1,
      OUT_FOR_DELIVERY: 1,
      READY_FOR_PICKUP: 1,
      FAILED: 1,
    },
    revenueByDay: [
      { date: "2026-06-22", amount: 120000 },
      { date: "2026-06-23", amount: 30000 },
    ],
    topRestaurants: [
      { restaurantId: "r1", name: "Demo Diner", revenue: { amount: 80000, currency: "INR" }, orders: 2 },
      { restaurantId: "r2", name: "Checkout Diner", revenue: { amount: 70000, currency: "INR" }, orders: 1 },
    ],
    ...overrides,
  };
}

const NOW = new Date("2026-06-28T12:00:00Z");

describe("analyticsAdapter", () => {
  it("converts money cards from minor units and formats them", () => {
    const vm = analyticsAdapter(makeResponse(), NOW);
    expect(vm.cards.revenue.amount).toBe(1500);
    expect(vm.cards.revenue.currency).toBe("INR");
    expect(vm.cards.revenue.formatted).toContain("1,500");
    expect(vm.cards.avgOrderValue.amount).toBe(250);
  });

  it("passes through count cards and trends (including negative and null)", () => {
    const vm = analyticsAdapter(
      makeResponse({
        cards: { ...makeResponse().cards, revenueTrendPct: null, ordersTrendPct: -8.2 },
      }),
      NOW,
    );
    expect(vm.cards.totalOrders).toBe(10);
    expect(vm.cards.activeOrders).toBe(2);
    expect(vm.cards.delivered).toBe(6);
    expect(vm.cards.cancelled).toBe(2);
    expect(vm.cards.restaurantCount).toBe(3);
    expect(vm.cards.revenueTrendPct).toBeNull();
    expect(vm.cards.ordersTrendPct).toBe(-8.2);
  });

  it("builds a 7-day revenue series (weekday labels, ÷100, zero-filled)", () => {
    const vm = analyticsAdapter(makeResponse(), NOW);
    expect(vm.revenueSeries.labels).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(vm.revenueSeries.values).toEqual([1200, 300, 0, 0, 0, 0, 0]);
  });

  it("maps statuses into the six display buckets (merging Ready and Cancelled)", () => {
    const vm = analyticsAdapter(makeResponse(), NOW);
    expect(vm.statusChart).toEqual([
      { label: "Created", value: 0 },
      { label: "Preparing", value: 1 },
      { label: "Ready", value: 1 }, // READY_FOR_PICKUP + PICKED_UP
      { label: "Out for delivery", value: 1 },
      { label: "Delivered", value: 6 },
      { label: "Cancelled", value: 3 }, // CANCELLED + FAILED
    ]);
  });

  it("maps top restaurants with converted+formatted revenue", () => {
    const vm = analyticsAdapter(makeResponse(), NOW);
    expect(vm.topRestaurants).toEqual([
      { restaurantId: "r1", name: "Demo Diner", revenue: expect.objectContaining({ amount: 800 }), orders: 2 },
      { restaurantId: "r2", name: "Checkout Diner", revenue: expect.objectContaining({ amount: 700 }), orders: 1 },
    ]);
  });

  it("handles an all-zero / empty response", () => {
    const vm = analyticsAdapter(
      makeResponse({
        cards: {
          revenue: { amount: 0, currency: "INR" },
          totalOrders: 0,
          activeOrders: 0,
          avgOrderValue: { amount: 0, currency: "INR" },
          delivered: 0,
          cancelled: 0,
          restaurantCount: 0,
          revenueTrendPct: null,
          ordersTrendPct: null,
        },
        statusBreakdown: {},
        revenueByDay: [],
        topRestaurants: [],
      }),
      NOW,
    );
    expect(vm.cards.revenue.amount).toBe(0);
    expect(vm.revenueSeries.values).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(vm.statusChart.every((b) => b.value === 0)).toBe(true);
    expect(vm.topRestaurants).toEqual([]);
  });
});
