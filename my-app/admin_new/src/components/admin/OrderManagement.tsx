"use client";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Search, Truck, Timer, XCircle } from "lucide-react";
import { useCartStore, type Order } from "../../store/cartStore";

export function OrderManagement() {
  const orders = useCartStore((state) => state.orders);
  const updateOrderStatus = useCartStore((state) => state.updateOrderStatus);

  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Drawer
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Pagination
  const itemsPerPage = 6;
  const [page, setPage] = useState(1);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-200 text-yellow-900 border-yellow-400";
      case "confirmed":
        return "bg-blue-200 text-blue-900 border-blue-400";
      case "preparing":
        return "bg-orange-200 text-orange-900 border-orange-400";
      case "Delivered":
        return "bg-green-200 text-green-900 border-green-400";
      case "cancelled":
        return "bg-red-200 text-red-900 border-red-400";
      default:
        return "";
    }
  };

  const statusTabs = [
    "all",
    "pending",
    "confirmed",
    "preparing",
    "Delivered",
    "cancelled",
  ];

  const filteredOrders = orders.filter((order) => {
    const matchStatus =
      selectedStatus === "all" || order.status === selectedStatus;

    const matchSearch =
      order.id.toLowerCase().includes(searchText.toLowerCase()) ||
      order.restaurantName.toLowerCase().includes(searchText.toLowerCase());

    return matchStatus && matchSearch;
  });

  const paginatedOrders = filteredOrders.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: Order["status"]
  ) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      toast.success(`Order ${orderId} updated to "${newStatus}"`);
    } catch {
      toast.error("Failed to update order status");
    }
  };

  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6 mt-6">
      <h3 className="text-xl font-semibold">Manage Orders</h3>

      {/* Search + Filter Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by order ID or restaurant..."
            className="pl-10"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {statusTabs.map((status) => (
            <Button
              key={status}
              variant={selectedStatus === status ? "default" : "outline"}
              onClick={() => {
                setSelectedStatus(status);
                setPage(1);
              }}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {/* Order Table */}
      <Card className="border-2 shadow-xl rounded-xl">
        <CardContent className="pt-6">
          {paginatedOrders.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">
              No orders found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Order ID</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedOrders.map((order) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="hover:bg-muted/20 transition-all cursor-pointer"
                  >
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.restaurantName}</TableCell>
                    <TableCell>{order.items.length} items</TableCell>
                    <TableCell>${order.total.toFixed(2)}</TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`px-3 py-1 border font-medium ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </Badge>

                      <Select
                        value={order.status}
                        onValueChange={(value: Order["status"]) =>
                          handleUpdateOrderStatus(order.id, value)
                        }
                      >
                        <SelectTrigger className="w-32 mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="preparing">Preparing</SelectItem>
                          <SelectItem value="Delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>{order.date}</TableCell>

                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openOrderDetails(order)}>
                        View Details
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-4 gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md">
          {selectedOrder && (
            <>
              <SheetHeader>
                <SheetTitle>Order Details</SheetTitle>
                <SheetDescription>Order ID: {selectedOrder.id}</SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div>
                  <Label>Restaurant</Label>
                  <p className="font-medium">{selectedOrder.restaurantName}</p>
                </div>

                <div>
                  <Label>Items</Label>
                  <div className="border rounded-lg p-3 space-y-1">
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{item.name}</span>
                        <span>x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Total</Label>
                  <p className="font-medium text-lg">
                    ${selectedOrder.total.toFixed(2)}
                  </p>
                </div>

                <div>
                  <Label>Status</Label>
                  <Badge
                    variant="outline"
                    className={`px-3 py-1 border ${getStatusColor(
                      selectedOrder.status
                    )}`}
                  >
                    {selectedOrder.status}
                  </Badge>
                </div>

                <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
