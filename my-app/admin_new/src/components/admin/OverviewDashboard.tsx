import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "motion/react";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Receipt,
  Store,
} from "lucide-react";
import { useCartStore } from "../../store/cartStore";
import { useRestaurantStore } from "../../store/restaurantStore";

export function OverviewDashboard() {
  const orders = useCartStore((state) => state.orders);
  const restaurants = useRestaurantStore((state) => state.restaurants);

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const totalOrders = orders.length;
  const activeOrders = orders.filter(
    (o) => o.status === "pending" || o.status === "preparing"
  ).length;

  // ⭐ Status → color mapping
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-500/15 text-yellow-700 border-yellow-500/20";
      case "preparing":
        return "bg-blue-500/15 text-blue-600 border-blue-500/20";
      case "confirmed":
        return "bg-indigo-500/15 text-indigo-600 border-indigo-500/20";
      case "delivered":
        return "bg-green-500/15 text-green-600 border-green-500/20";
      case "cancelled":
        return "bg-red-500/15 text-red-600 border-red-500/20";
      default:
        return "bg-gray-500/15 text-gray-600 border-gray-500/20";
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Revenue Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <h2 className="mt-2 text-2xl font-bold">
                    ${totalRevenue.toFixed(2)}
                  </h2>
                </div>
                <div className="p-3 bg-green-500/10 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-green-500 font-medium">+12.5%</span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <h2 className="mt-2 text-2xl font-bold">{totalOrders}</h2>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <ShoppingBag className="h-6 w-6 text-blue-500" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-blue-500 font-medium">+8.2%</span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Active Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Orders</p>
                  <h2 className="mt-2 text-2xl font-bold">{activeOrders}</h2>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-full">
                  <Receipt className="h-6 w-6 text-orange-500" />
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Currently processing
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Restaurants */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Restaurants</p>
                  <h2 className="mt-2 text-2xl font-bold">
                    {restaurants.length}
                  </h2>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-full">
                  <Store className="h-6 w-6 text-purple-500" />
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Active partners
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Orders */}
      <Card className="border-2 shadow-lg">
        <CardContent className="pt-6">
          <h3 className="mb-4 text-xl font-semibold">Recent Orders</h3>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Order ID</TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {orders.slice(0, 5).map((order) => (
                <TableRow
                  key={order.id}
                  className="transition-all hover:bg-accent/50 cursor-pointer"
                >
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{order.restaurantName}</TableCell>
                  <TableCell>${order.total.toFixed(2)}</TableCell>

                  <TableCell>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-md border ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </TableCell>

                  <TableCell>{order.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
