"use client";
import { useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag,
  Receipt, Store, CheckCircle2, XCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useOwnerRestaurants } from "@/lib/api/hooks/useOwnerCatalog";
import { useOverviewAnalytics } from "@/lib/api/hooks/useDashboardAnalytics";
import type { DashboardAnalyticsView } from "@/lib/api/adapters/analytics";

/**
 * Owner/Admin Overview (Phase 15 / G13). Real, server-driven analytics from the
 * fulfillment `admin_dashboard_views` projection (`useOverviewAnalytics` →
 * `/owner/analytics` or `/admin/analytics`). Cuisine distribution stays a
 * client-side cut of the owner's catalog and is hidden for the platform admin.
 * The legacy stubbed-orders math (Batch 10.1) is gone.
 */

export interface TrendView {
  text: string;
  positive: boolean;
}

export interface StatCard {
  label: string;
  value: string;
  trend: TrendView | null;
}

/** Signed percent label + direction; null when the previous window had no activity. */
export function formatTrend(pct: number | null): TrendView | null {
  if (pct === null) return null;
  const sign = pct >= 0 ? "+" : "";
  return { text: `${sign}${pct}%`, positive: pct >= 0 };
}

/** The seven Overview stat cards derived from the analytics view (Points Issued dropped — G13). */
export function buildStatCards(view: DashboardAnalyticsView): StatCard[] {
  const c = view.cards;
  return [
    { label: "Total Revenue", value: c.revenue.formatted, trend: formatTrend(c.revenueTrendPct) },
    { label: "Total Orders", value: String(c.totalOrders), trend: formatTrend(c.ordersTrendPct) },
    { label: "Active Orders", value: String(c.activeOrders), trend: null },
    { label: "Restaurants", value: String(c.restaurantCount), trend: null },
    { label: "Avg Order Value", value: c.avgOrderValue.formatted, trend: null },
    { label: "Delivered", value: String(c.delivered), trend: null },
    { label: "Cancelled", value: String(c.cancelled), trend: null },
  ];
}

/** Cuisine distribution is owner-scoped (client cut of owned restaurants); hidden for the platform admin. */
export function shouldShowCuisineDistribution(isAdmin: boolean | undefined): boolean {
  return !isAdmin;
}

const CARD_STYLES: Record<string, { icon: typeof DollarSign; color: string; bg: string }> = {
  "Total Revenue": { icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
  "Total Orders": { icon: ShoppingBag, color: "text-blue-500", bg: "bg-blue-500/10" },
  "Active Orders": { icon: Receipt, color: "text-orange-500", bg: "bg-orange-500/10" },
  "Restaurants": { icon: Store, color: "text-purple-500", bg: "bg-purple-500/10" },
  "Avg Order Value": { icon: TrendingUp, color: "text-teal-500", bg: "bg-teal-500/10" },
  "Delivered": { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  "Cancelled": { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
};

function useChart(ref: React.RefObject<HTMLCanvasElement>, build: () => any, deps: any[]) {
  useEffect(() => {
    if (!ref.current) return;
    const canvas = ref.current as any;
    let cancelled = false;

    if (canvas._chartInstance) {
      canvas._chartInstance.destroy();
      canvas._chartInstance = null;
    }

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !ref.current) return;
      if ((ref.current as any)._chartInstance) {
        (ref.current as any)._chartInstance.destroy();
        (ref.current as any)._chartInstance = null;
      }
      const c = new Chart(ref.current, build());
      (ref.current as any)._chartInstance = c;
    });

    return () => {
      cancelled = true;
      if (canvas._chartInstance) {
        canvas._chartInstance.destroy();
        canvas._chartInstance = null;
      }
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

export function OverviewDashboard() {
  const isAdmin = useAuthStore((s) => s.user?.isAdmin);
  const analytics = useOverviewAnalytics();
  const { data: ownerRestaurants } = useOwnerRestaurants();
  const view = analytics.data;

  const showCuisine = shouldShowCuisineDistribution(isAdmin);

  const cuisineMap = useMemo(() => {
    const map: Record<string, number> = {};
    (ownerRestaurants ?? []).forEach((r) => {
      r.cuisineTypes.forEach((cuisine) => {
        map[cuisine] = (map[cuisine] || 0) + 1;
      });
    });
    return map;
  }, [ownerRestaurants]);

  const isDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const textColor = isDark ? "#c2c0b6" : "#3d3d3a";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  const revenueRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLCanvasElement>(null);
  const cuisineRef = useRef<HTMLCanvasElement>(null);

  useChart(revenueRef as any, () => ({
    type: "line",
    data: {
      labels: view?.revenueSeries.labels ?? [],
      datasets: [{ label: "Revenue", data: view?.revenueSeries.values ?? [], borderColor: "#7F77DD",
        backgroundColor: "rgba(127,119,221,0.12)", borderWidth: 2,
        pointRadius: 4, pointBackgroundColor: "#7F77DD", fill: true, tension: 0.4 }],
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } },
      },
    },
  }), [view?.revenueSeries, isDark]);

  useChart(statusRef as any, () => ({
    type: "doughnut",
    data: {
      labels: (view?.statusChart ?? []).map((s) => s.label),
      datasets: [{ data: (view?.statusChart ?? []).map((s) => s.value),
        backgroundColor: ["#85B7EB", "#F0997B", "#FAC775", "#AFA9EC", "#97C459", "#F09595"],
        borderWidth: 0 }],
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: "65%",
      plugins: { legend: { position: "bottom", labels: { color: textColor, padding: 10, font: { size: 11 } } } },
    },
  }), [view?.statusChart, isDark]);

  useChart(topRef as any, () => ({
    type: "bar",
    data: {
      labels: (view?.topRestaurants ?? []).map((r) => r.name.length > 14 ? r.name.slice(0, 14) + "…" : r.name),
      datasets: [{ label: "Revenue", data: (view?.topRestaurants ?? []).map((r) => r.revenue.amount),
        backgroundColor: "#1D9E75", borderRadius: 6 }],
    },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: "y" as const,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { display: false } },
      },
    },
  }), [view?.topRestaurants, isDark]);

  useChart(cuisineRef as any, () => ({
    type: "pie",
    data: {
      labels: Object.keys(cuisineMap),
      datasets: [{ data: Object.values(cuisineMap),
        backgroundColor: ["#7F77DD", "#1D9E75", "#D85A30", "#378ADD", "#BA7517", "#D4537E", "#639922", "#888780"],
        borderWidth: 0 }],
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: textColor, padding: 10, font: { size: 11 } } } },
    },
  }), [cuisineMap, isDark, showCuisine]);

  if (analytics.isLoading) {
    return (
      <div className="space-y-6 mt-6">
        <p className="text-center text-muted-foreground py-16">Loading analytics…</p>
      </div>
    );
  }

  if (analytics.isError || !view) {
    return (
      <div className="space-y-6 mt-6">
        <Card className="border-2 border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            Couldn’t load analytics. Please try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = buildStatCards(view);

  return (
    <div className="space-y-6 mt-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((c, i) => {
          const style = CARD_STYLES[c.label];
          const Icon = style.icon;
          return (
            <motion.div key={c.label}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}>
              <Card className="border-2 shadow-md hover:shadow-lg transition-all">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <div className={`p-2 rounded-lg ${style.bg}`}>
                      <Icon className={`h-4 w-4 ${style.color}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{c.value}</p>
                  {c.trend && (
                    <p className={`text-xs mt-1 flex items-center gap-1 ${c.trend.positive ? "text-green-600" : "text-red-600"}`}>
                      {c.trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {c.trend.text} vs prev {view.windowDays}d
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Revenue line + Status doughnut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-2 shadow-md lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue — last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 220 }}><canvas ref={revenueRef} /></div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Orders by status</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 220 }}><canvas ref={statusRef} /></div>
          </CardContent>
        </Card>
      </div>

      {/* Top restaurants + (owner-only) Cuisine distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-2 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top restaurants by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 220 }}><canvas ref={topRef} /></div>
          </CardContent>
        </Card>

        {showCuisine && (
          <Card className="border-2 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cuisine distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ height: 220 }}><canvas ref={cuisineRef} /></div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
