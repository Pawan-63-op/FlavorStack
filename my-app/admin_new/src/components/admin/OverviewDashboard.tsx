"use client";
import { useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag,
  Receipt, Store, Star,
} from "lucide-react";
import { useCartStore } from "../../store/cartStore";
import { useRestaurantStore } from "../../store/restaurantStore";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useChart(
  ref: React.RefObject<HTMLCanvasElement>,
  build: () => any,
  deps: any[]
) {
  useEffect(() => {
    if (!ref.current) return;
    const canvas = ref.current as any;
    let cancelled = false;

    // Destroy existing chart synchronously before async import
    if (canvas._chartInstance) {
      canvas._chartInstance.destroy();
      canvas._chartInstance = null;
    }

    import("chart.js/auto").then(({ default: Chart }) => {
      // If cleanup already ran before import resolved, do nothing
      if (cancelled || !ref.current) return;

      // Destroy again in case another effect ran while import was loading
      if ((ref.current as any)._chartInstance) {
        (ref.current as any)._chartInstance.destroy();
        (ref.current as any)._chartInstance = null;
      }

      const c = new Chart(ref.current, build());
      (ref.current as any)._chartInstance = c;
    });

    return () => {
      cancelled = true; // prevent async creation after cleanup
      if (canvas._chartInstance) {
        canvas._chartInstance.destroy();
        canvas._chartInstance = null;
      }
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

export function OverviewDashboard() {
  const orders      = useCartStore((s) => s.orders);
  const fetchOrders = useCartStore((s) => s.fetchOrders);
  const restaurants = useRestaurantStore((s) => s.restaurants);
  const fetchR      = useRestaurantStore((s) => s.fetchRestaurants);

  useEffect(() => { fetchOrders(); fetchR(); }, []);

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "Delivered");
    const cancelled = orders.filter((o) => o.status === "cancelled");
    const active    = orders.filter((o) => !["Delivered", "cancelled"].includes(o.status));
    const revenue   = delivered.reduce((s, o) => s + o.total, 0);
    const avgOrder  = delivered.length ? revenue / delivered.length : 0;
    const totalPts  = orders.reduce((s, o) => s + (o.pointsEarned || 0), 0);

    // Last 7 days revenue
    const labels7: string[] = [];
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { weekday: "short" });
      labels7.push(key); days[key] = 0;
    }
    delivered.forEach((o) => {
      if (!o.createdAt) return;
      const key = new Date(o.createdAt).toLocaleDateString("en-US", { weekday: "short" });
      if (key in days) days[key] += o.total;
    });

    // Status counts
    const statusCounts = {
      Pending:           orders.filter((o) => o.status === "pending").length,
      Confirmed:         orders.filter((o) => o.status === "confirmed").length,
      Preparing:         orders.filter((o) => o.status === "preparing").length,
      "Out for delivery":orders.filter((o) => o.status === "out-for-delivery").length,
      Delivered:         delivered.length,
      Cancelled:         cancelled.length,
    };

    // Top 5 restaurants by revenue
    const revByR: Record<string, number> = {};
    delivered.forEach((o) => {
      const n = String(o.restaurantName);
      revByR[n] = (revByR[n] || 0) + o.total;
    });
    const topRestaurants = Object.entries(revByR).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Cuisine distribution — normalise to avoid "Japanese" vs " Japanese" duplicates
    const cuisineMap: Record<string, number> = {};
    restaurants.forEach((r: any) => {
      if (!r.cuisine) return;
      const key = r.cuisine.trim(); // trim whitespace
      cuisineMap[key] = (cuisineMap[key] || 0) + 1;
    });

    return {
      revenue, avgOrder, totalPts,
      totalOrders: orders.length,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      activeCount: active.length,
      labels7, revenue7: labels7.map((k) => days[k]),
      statusCounts, topRestaurants, cuisineMap,
    };
  }, [orders, restaurants]);

  const isDark    = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const textColor = isDark ? "#c2c0b6" : "#3d3d3a";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  const revenueRef = useRef<HTMLCanvasElement>(null);
  const statusRef  = useRef<HTMLCanvasElement>(null);
  const cuisineRef = useRef<HTMLCanvasElement>(null);
  const topRef     = useRef<HTMLCanvasElement>(null);

  useChart(revenueRef as any, () => ({
    type: "line",
    data: {
      labels: stats.labels7,
      datasets: [{ label: "Revenue ($)", data: stats.revenue7, borderColor: "#7F77DD",
        backgroundColor: "rgba(127,119,221,0.12)", borderWidth: 2,
        pointRadius: 4, pointBackgroundColor: "#7F77DD", fill: true, tension: 0.4 }],
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, callback: (v: any) => `$${v}` }, grid: { color: gridColor } },
      },
    },
  }), [stats.revenue7, isDark]);

  useChart(statusRef as any, () => ({
    type: "doughnut",
    data: {
      labels: Object.keys(stats.statusCounts),
      datasets: [{ data: Object.values(stats.statusCounts),
        backgroundColor: ["#FAC775","#85B7EB","#F0997B","#AFA9EC","#97C459","#F09595"],
        borderWidth: 0 }],
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: "65%",
      plugins: { legend: { position: "bottom", labels: { color: textColor, padding: 10, font: { size: 11 } } } },
    },
  }), [stats.statusCounts, isDark]);

  useChart(cuisineRef as any, () => ({
    type: "pie",
    data: {
      labels: Object.keys(stats.cuisineMap),
      datasets: [{ data: Object.values(stats.cuisineMap),
        backgroundColor: ["#7F77DD","#1D9E75","#D85A30","#378ADD","#BA7517","#D4537E","#639922","#888780"],
        borderWidth: 0 }],
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: textColor, padding: 10, font: { size: 11 } } } },
    },
  }), [stats.cuisineMap, isDark]);

  useChart(topRef as any, () => ({
    type: "bar",
    data: {
      labels: stats.topRestaurants.map(([n]) => n.length > 14 ? n.slice(0, 14) + "…" : n),
      datasets: [{ label: "Revenue ($)", data: stats.topRestaurants.map(([, v]) => v),
        backgroundColor: "#1D9E75", borderRadius: 6 }],
    },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: "y" as const,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor, callback: (v: any) => `$${v}` }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { display: false } },
      },
    },
  }), [stats.topRestaurants, isDark]);

  const statCards = [
    { label: "Total Revenue",   value: `$${fmt(stats.revenue)}`,         icon: DollarSign,  color: "text-green-500",  bg: "bg-green-500/10",  trend: "+12.5%" },
    { label: "Total Orders",    value: String(stats.totalOrders),         icon: ShoppingBag, color: "text-blue-500",   bg: "bg-blue-500/10",   trend: "+8.2%" },
    { label: "Active Orders",   value: String(stats.activeCount),         icon: Receipt,     color: "text-orange-500", bg: "bg-orange-500/10", trend: null },
    { label: "Restaurants",     value: String(restaurants.length),        icon: Store,       color: "text-purple-500", bg: "bg-purple-500/10", trend: null },
    { label: "Avg Order Value", value: `$${fmt(stats.avgOrder)}`,         icon: TrendingUp,  color: "text-teal-500",   bg: "bg-teal-500/10",   trend: null },
    { label: "Points Issued",   value: stats.totalPts.toLocaleString(),   icon: Star,        color: "text-amber-500",  bg: "bg-amber-500/10",  trend: null },
    { label: "Delivered",       value: String(stats.deliveredCount),      icon: TrendingUp,  color: "text-green-500",  bg: "bg-green-500/10",  trend: null },
    { label: "Cancelled",       value: String(stats.cancelledCount),      icon: TrendingDown,color: "text-red-500",    bg: "bg-red-500/10",    trend: null },
  ];

  const getStatusColor = (s: string) => ({
    pending:            "bg-yellow-100 text-yellow-800 border-yellow-300",
    confirmed:          "bg-blue-100 text-blue-800 border-blue-300",
    preparing:          "bg-orange-100 text-orange-800 border-orange-300",
    "out-for-delivery": "bg-purple-100 text-purple-800 border-purple-300",
    Delivered:          "bg-green-100 text-green-800 border-green-300",
    cancelled:          "bg-red-100 text-red-800 border-red-300",
  } as Record<string,string>)[s] ?? "bg-gray-100 text-gray-800 border-gray-300";

  return (
    <div className="space-y-6 mt-6">

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div key={c.label}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}>
              <Card className="border-2 shadow-md hover:shadow-lg transition-all">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <div className={`p-2 rounded-lg ${c.bg}`}>
                      <Icon className={`h-4 w-4 ${c.color}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{c.value}</p>
                  {c.trend && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />{c.trend} vs last month
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

      {/* Top restaurants + Cuisine distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-2 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top restaurants by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 220 }}><canvas ref={topRef} /></div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cuisine distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 220 }}><canvas ref={cuisineRef} /></div>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="border-2 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 text-muted-foreground font-medium">Order ID</th>
                  <th className="pb-3 text-muted-foreground font-medium">Restaurant</th>
                  <th className="pb-3 text-muted-foreground font-medium">Total</th>
                  <th className="pb-3 text-muted-foreground font-medium">Status</th>
                  <th className="pb-3 text-muted-foreground font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.slice(0, 8).map((order) => (
                  <tr key={order._id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-mono text-xs">{order.orderId}</td>
                    <td className="py-3">{String(order.restaurantName)}</td>
                    <td className="py-3 font-medium">${order.total.toFixed(2)}</td>
                    <td className="py-3">
                      <Badge variant="outline"
                        className={`text-xs border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-muted-foreground">{order.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">No orders yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}