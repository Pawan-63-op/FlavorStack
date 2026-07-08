import { describe, expect, it } from "vitest";
import {
  buildStatCards,
  formatTrend,
  shouldShowCuisineDistribution,
} from "./OverviewDashboard";
import type { DashboardAnalyticsView } from "@/lib/api/adapters/analytics";

function makeView(overrides: Partial<DashboardAnalyticsView["cards"]> = {}): DashboardAnalyticsView {
  return {
    scope: "OWNER",
    windowDays: 30,
    currency: "INR",
    cards: {
      revenue: { amount: 1500, currency: "INR", formatted: "₹1,500.00" },
      totalOrders: 10,
      activeOrders: 2,
      avgOrderValue: { amount: 250, currency: "INR", formatted: "₹250.00" },
      delivered: 6,
      cancelled: 2,
      restaurantCount: 3,
      revenueTrendPct: 12.5,
      ordersTrendPct: -8.2,
      ...overrides,
    },
    statusChart: [],
    revenueSeries: { labels: [], values: [] },
    topRestaurants: [],
  };
}

describe("formatTrend", () => {
  it("prefixes a positive trend with + and marks it positive", () => {
    expect(formatTrend(12.5)).toEqual({ text: "+12.5%", positive: true });
  });

  it("keeps the minus sign for a negative trend and marks it not positive", () => {
    expect(formatTrend(-8.2)).toEqual({ text: "-8.2%", positive: false });
  });

  it("returns null when the trend is null (previous window had no activity)", () => {
    expect(formatTrend(null)).toBeNull();
  });
});

describe("buildStatCards", () => {
  it("derives the seven cards from the analytics view (no Points Issued)", () => {
    const cards = buildStatCards(makeView());
    expect(cards.map((c) => c.label)).toEqual([
      "Total Revenue",
      "Total Orders",
      "Active Orders",
      "Restaurants",
      "Avg Order Value",
      "Delivered",
      "Cancelled",
    ]);
    expect(cards.map((c) => c.label)).not.toContain("Points Issued");
  });

  it("uses formatted money and real trends on revenue/orders", () => {
    const cards = buildStatCards(makeView());
    const byLabel = Object.fromEntries(cards.map((c) => [c.label, c]));
    expect(byLabel["Total Revenue"].value).toBe("₹1,500.00");
    expect(byLabel["Total Revenue"].trend).toEqual({ text: "+12.5%", positive: true });
    expect(byLabel["Total Orders"].trend).toEqual({ text: "-8.2%", positive: false });
    expect(byLabel["Avg Order Value"].value).toBe("₹250.00");
    expect(byLabel["Active Orders"].trend).toBeNull();
  });

  it("renders an all-zero view without trends (empty-owner zero state)", () => {
    const zero = makeView({
      revenue: { amount: 0, currency: "INR", formatted: "₹0.00" },
      totalOrders: 0,
      activeOrders: 0,
      avgOrderValue: { amount: 0, currency: "INR", formatted: "₹0.00" },
      delivered: 0,
      cancelled: 0,
      restaurantCount: 0,
      revenueTrendPct: null,
      ordersTrendPct: null,
    });
    const cards = buildStatCards(zero);
    const byLabel = Object.fromEntries(cards.map((c) => [c.label, c]));
    expect(byLabel["Total Orders"].value).toBe("0");
    expect(byLabel["Restaurants"].value).toBe("0");
    expect(byLabel["Total Revenue"].trend).toBeNull();
    expect(byLabel["Total Orders"].trend).toBeNull();
  });
});

describe("shouldShowCuisineDistribution", () => {
  it("shows cuisine distribution for owners (non-admin)", () => {
    expect(shouldShowCuisineDistribution(false)).toBe(true);
    expect(shouldShowCuisineDistribution(undefined)).toBe(true);
  });

  it("hides cuisine distribution for the platform admin", () => {
    expect(shouldShowCuisineDistribution(true)).toBe(false);
  });
});
