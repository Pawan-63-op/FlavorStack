"use client";
import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader,
  SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Search, ChevronLeft, ChevronRight,
  CheckCircle, ChefHat, Truck, XCircle,
  MapPin, Phone, User, RefreshCw, Loader2, Package,
} from "lucide-react";
import { useCartStore, type Order } from "../../store/cartStore";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending:            { color: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "Pending" },
  confirmed:          { color: "bg-blue-100 text-blue-800 border-blue-300",       label: "Confirmed" },
  preparing:          { color: "bg-orange-100 text-orange-800 border-orange-300", label: "Preparing" },
  "out-for-delivery": { color: "bg-purple-100 text-purple-800 border-purple-300", label: "Out for Delivery" },
  Delivered:          { color: "bg-green-100 text-green-800 border-green-300",    label: "Delivered" },
  cancelled:          { color: "bg-red-100 text-red-800 border-red-300",          label: "Cancelled" },
};

const NEXT_STATUS: Partial<Record<Order["status"], Order["status"]>> = {
  pending:            "confirmed",
  confirmed:          "preparing",
  preparing:          "out-for-delivery",
  "out-for-delivery": "Delivered",
};

const NEXT_LABEL: Partial<Record<string, string>> = {
  pending:            "Confirm",
  confirmed:          "Start Preparing",
  preparing:          "Out for Delivery",
  "out-for-delivery": "Mark Delivered",
};

const NEXT_ICON: Partial<Record<string, React.ReactNode>> = {
  pending:            <CheckCircle className="h-3.5 w-3.5" />,
  confirmed:          <ChefHat className="h-3.5 w-3.5" />,
  preparing:          <Truck className="h-3.5 w-3.5" />,
  "out-for-delivery": <Package className="h-3.5 w-3.5" />,
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { color: "", label: status };
  return (
    <Badge variant="outline" className={`px-2.5 py-0.5 border font-medium text-xs ${cfg.color}`}>
      {cfg.label}
    </Badge>
  );
}

const STATUS_TABS = ["all", "pending", "confirmed", "preparing", "out-for-delivery", "Delivered", "cancelled"];
const ITEMS_PER_PAGE = 8;

export function OrderManagement() {
  const orders            = useCartStore((s) => s.orders);
  const fetchOrders       = useCartStore((s) => s.fetchOrders);
  const updateOrderStatus = useCartStore((s) => s.updateOrderStatus);
  const cancelOrder       = useCartStore((s) => s.cancelOrder);
  const isLoading         = useCartStore((s) => s.isLoading);

  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchText, setSearchText]         = useState("");
  const [page, setPage]                     = useState(1);
  const [updatingId, setUpdatingId]         = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder]   = useState<Order | null>(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  useEffect(() => { fetchOrders(); }, []);

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filtered = orders.filter((o) => {
    const matchStatus = selectedStatus === "all" || o.status === selectedStatus;
    const q = searchText.toLowerCase();
    const matchSearch =
      (o.orderId || "").toLowerCase().includes(q) ||
      String(o.restaurantName).toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated  = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // FIX 1: use order.orderId (display ID like ORD-xxx) — backend routes use this, not _id
  const handleUpdateStatus = async (order: Order, newStatus: Order["status"]) => {
    const id = order.orderId;
    setUpdatingId(id);
    try {
      await updateOrderStatus(id, newStatus);
      toast.success(`Updated to "${STATUS_CONFIG[newStatus]?.label || newStatus}"`);
      // FIX 2: sync drawer using orderId not _id
      if (selectedOrder?.orderId === id) {
        setSelectedOrder((o) => o ? { ...o, status: newStatus } : o);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update order status");
    } finally {
      setUpdatingId(null);
    }
  };

  // FIX 3: cancelTargetId stores orderId, isUpdating checks orderId
  const handleCancel = async () => {
    if (!cancelTargetId) return;
    setUpdatingId(cancelTargetId);
    try {
      await cancelOrder(cancelTargetId);
      toast.success("Order cancelled");
      if (selectedOrder?.orderId === cancelTargetId) {
        setSelectedOrder((o) => o ? { ...o, status: "cancelled" } : o);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel order");
    } finally {
      setUpdatingId(null);
      setCancelTargetId(null);
    }
  };

  const openDetails = (order: Order) => {
    setSelectedOrder(order);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6 mt-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Manage Orders</h3>
        <Button variant="outline" size="sm" className="gap-2"
          onClick={() => fetchOrders()} disabled={isLoading}>
          {isLoading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total",     value: orders.length, color: "text-foreground" },
          { label: "Active",    value: (statusCounts.pending||0)+(statusCounts.confirmed||0)+(statusCounts.preparing||0)+(statusCounts["out-for-delivery"]||0), color: "text-orange-600" },
          { label: "Delivered", value: statusCounts.Delivered || 0, color: "text-green-600" },
          { label: "Cancelled", value: statusCounts.cancelled || 0, color: "text-red-600" },
        ].map((s) => (
          <Card key={s.label} className="border">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by order ID or restaurant..."
            className="pl-10" value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(1); }} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const count = tab === "all" ? orders.length : (statusCounts[tab] || 0);
            return (
              <Button key={tab} size="sm"
                variant={selectedStatus === tab ? "default" : "outline"}
                onClick={() => { setSelectedStatus(tab); setPage(1); }}
                className="gap-1.5 whitespace-nowrap">
                {STATUS_CONFIG[tab]?.label || "All"}
                {count > 0 && (
                  <span className={`text-xs rounded-full px-1.5 ${
                    selectedStatus === tab
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>{count}</span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <Card className="border-2 shadow-lg rounded-xl">
        <CardContent className="pt-6">
          {isLoading && orders.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : paginated.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No orders found.</p>
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
                {paginated.map((order) => {
                  const nextStatus = NEXT_STATUS[order.status];
                  // FIX 4: isUpdating checks orderId
                  const isUpdating = updatingId === order.orderId;

                  return (
                    <motion.tr key={order._id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="hover:bg-muted/20 transition-all">
                      <TableCell className="font-mono text-xs">{order.orderId}</TableCell>
                      <TableCell className="font-medium">{String(order.restaurantName)}</TableCell>
                      <TableCell>{order.items.length} items</TableCell>
                      <TableCell>${order.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <StatusBadge status={order.status} />
                          <Select
                            value={order.status}
                            disabled={isUpdating}
                            onValueChange={(v: Order["status"]) => handleUpdateStatus(order, v)}
                          >
                            <SelectTrigger className="w-36 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                                <SelectItem key={val} value={val} className="text-xs">
                                  {cfg.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{order.date}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {nextStatus && (
                            <Button size="sm" variant="outline"
                              className="gap-1 text-xs h-7" disabled={isUpdating}
                              onClick={() => handleUpdateStatus(order, nextStatus)}>
                              {isUpdating
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : NEXT_ICON[order.status]}
                              {NEXT_LABEL[order.status]}
                            </Button>
                          )}
                          {/* FIX 5: cancel stores order.orderId */}
                          {!["Delivered", "cancelled"].includes(order.status) && (
                            <Button size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              disabled={isUpdating}
                              onClick={() => setCancelTargetId(order.orderId)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => openDetails(order)}>
                            Details
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button variant="outline" size="icon" disabled={page === 1}
                onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="icon" disabled={page === totalPages}
                onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedOrder && (
            <>
              <SheetHeader>
                <SheetTitle>Order Details</SheetTitle>
                <SheetDescription className="font-mono text-xs">
                  {selectedOrder.orderId}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Current Status</p>
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                  {/* FIX 6: drawer buttons use orderId */}
                  {NEXT_STATUS[selectedOrder.status] && (
                    <Button size="sm" className="gap-1.5"
                      disabled={updatingId === selectedOrder.orderId}
                      onClick={() => handleUpdateStatus(
                        selectedOrder,
                        NEXT_STATUS[selectedOrder.status]!
                      )}>
                      {NEXT_ICON[selectedOrder.status]}
                      {NEXT_LABEL[selectedOrder.status]}
                    </Button>
                  )}
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Restaurant</p>
                  <p className="font-semibold">{String(selectedOrder.restaurantName)}</p>
                </div>
                {selectedOrder.deliveryAddress && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Delivery Address</p>
                      <div className="p-3 bg-accent rounded-xl space-y-1.5">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{selectedOrder.deliveryAddress.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{selectedOrder.deliveryAddress.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{selectedOrder.deliveryAddress.address}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Order Items</p>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-accent rounded-lg text-sm">
                        <span>{item.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">×{item.quantity}</span>
                          <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${selectedOrder.subtotal?.toFixed(2) ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>${selectedOrder.deliveryFee?.toFixed(2) ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>${selectedOrder.tax?.toFixed(2) ?? "—"}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-${selectedOrder.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-lg">${selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-accent rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Payment</p>
                    <p className="font-medium capitalize">{selectedOrder.paymentMethod}</p>
                  </div>
                  <div className="p-3 bg-accent rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Points Earned</p>
                    <p className="font-medium text-amber-600">+{selectedOrder.pointsEarned}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Change Status</p>
                  <Select
                    value={selectedOrder.status}
                    disabled={updatingId === selectedOrder.orderId}
                    onValueChange={(v: Order["status"]) => handleUpdateStatus(selectedOrder, v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                        <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* FIX 7: cancel from drawer stores orderId */}
                {!["Delivered", "cancelled"].includes(selectedOrder.status) && (
                  <Button variant="destructive" className="w-full gap-2"
                    onClick={() => {
                      setDrawerOpen(false);
                      setCancelTargetId(selectedOrder.orderId);
                    }}>
                    <XCircle className="h-4 w-4" /> Cancel Order
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel confirmation */}
      <AlertDialog open={!!cancelTargetId}
        onOpenChange={(o) => { if (!o) setCancelTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the order as cancelled and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancel}>
              Yes, Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}