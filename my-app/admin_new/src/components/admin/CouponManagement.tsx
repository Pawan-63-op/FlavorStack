"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Save, Tag, Percent, Truck } from "lucide-react";
import { toast } from "sonner";
import { useCouponStore, type Coupon } from "../../store/couponStore";

export function CouponManagement() {
  const coupons = useCouponStore((state) => state.coupons);
  const fetchCoupons = useCouponStore((state) => state.fetchCoupons);
  const addCoupon = useCouponStore((state) => state.addCoupon);
  const updateCoupon = useCouponStore((state) => state.updateCoupon);
  const deleteCoupon = useCouponStore((state) => state.deleteCoupon);
  const toggleCoupon = useCouponStore((state) => state.toggleCoupon);

  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [isAddingCoupon, setIsAddingCoupon] = useState(false);

  const [couponForm, setCouponForm] = useState<Partial<Coupon>>({
    code: "",
    discount: 0,
    type: "percentage",
    description: "",
    minOrder: undefined,
    maxDiscount: undefined,
    isActive: true,
  });

  const handleSaveCoupon = async () => {
    if (!couponForm.code || !couponForm.description || !couponForm.discount) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (editingCoupon) {
      await updateCoupon(editingCoupon._id, couponForm);
      toast.success("Coupon updated successfully!");
    } else {
      await addCoupon(couponForm as Omit<Coupon, "id">);
      toast.success("Coupon added successfully!");
    }

    await fetchCoupons();
    resetForm();
  };

  const handleDeleteCoupon = async (id: string) => {
    await deleteCoupon(id);
    await fetchCoupons();
    toast.success("Coupon deleted successfully!");
  };

  const handleToggleCoupon = async (id: string, isActive: boolean) => {
    await toggleCoupon(id, isActive);
    toast.success(isActive ? "Coupon activated!" : "Coupon deactivated!");
  };

  const handleEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCouponForm(coupon);
    setIsAddingCoupon(true);
  };

  const resetForm = () => {
    setEditingCoupon(null);
    setIsAddingCoupon(false);
    setCouponForm({
      code: "",
      discount: 0,
      type: "percentage",
      description: "",
      minOrder: undefined,
      maxDiscount: undefined,
      isActive: true,
    });
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const getCouponColor = (type: string) => {
    if (type === "percentage") return "bg-blue-500/10 text-blue-600";
    if (type === "fixed") return "bg-green-500/10 text-green-600";
    return "bg-purple-500/10 text-purple-600";
  };

  const getCouponIcon = (type: string) => {
    if (type === "percentage") return <Percent className="h-6 w-6" />;
    if (type === "fixed") return <Tag className="h-6 w-6" />;
    return <Truck className="h-6 w-6" />;
  };

  return (
    <div className="space-y-8 mt-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h3 className="text-3xl font-semibold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          Coupon Management
        </h3>

        <Dialog open={isAddingCoupon} onOpenChange={setIsAddingCoupon}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-lg shadow bg-gradient-to-r from-purple-600 to-primary text-white">
              <Plus className="h-4 w-4" /> Add Coupon
            </Button>
          </DialogTrigger>

          {/* POPUP */}
          <DialogContent className="max-w-2xl bg-background/80 backdrop-blur-xl rounded-2xl border shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {editingCoupon ? "Edit Coupon" : "Add New Coupon"}
              </DialogTitle>
              <DialogDescription>Configure your promotional offer</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* CODE + TYPE */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Coupon Code *</Label>
                  <Input
                    placeholder="SAVE20"
                    value={couponForm.code}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })
                    }
                    className="rounded-lg"
                  />
                </div>

                <div>
                  <Label>Type *</Label>
                  <Select
                    value={couponForm.type}
                    onValueChange={(value:any) => setCouponForm({ ...couponForm})}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="shipping">Free Shipping</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* DESCRIPTION */}
              <div>
                <Label>Description *</Label>
                <Input
                  placeholder="20% off on all orders"
                  value={couponForm.description}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, description: e.target.value })
                  }
                  className="rounded-lg"
                />
              </div>

              {/* DISCOUNT */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Discount *</Label>
                  <Input
                    type="number"
                    value={couponForm.discount}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, discount: parseFloat(e.target.value) })
                    }
                    className="rounded-lg"
                  />
                </div>

                <div>
                  <Label>Minimum Order (optional)</Label>
                  <Input
                    type="number"
                    value={couponForm.minOrder || ""}
                    onChange={(e) =>
                      setCouponForm({
                        ...couponForm,
                        minOrder: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="rounded-lg"
                  />
                </div>
              </div>

              {/* MAX DISCOUNT */}
              {couponForm.type === "percentage" && (
                <div>
                  <Label>Max Discount (optional)</Label>
                  <Input
                    type="number"
                    value={couponForm.maxDiscount || ""}
                    onChange={(e) =>
                      setCouponForm({
                        ...couponForm,
                        maxDiscount: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="rounded-lg"
                  />
                </div>
              )}

              <Button className="w-full rounded-lg" onClick={handleSaveCoupon}>
                <Save className="h-4 w-4 mr-2" />
                {editingCoupon ? "Update Coupon" : "Create Coupon"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* COUPON LIST */}
      <div className="grid grid-cols-1 gap-5">
        {coupons.map((coupon) => (
          <Card
            key={coupon.id}
            className="border shadow-md rounded-2xl bg-background/70 backdrop-blur-md hover:shadow-xl hover:scale-[1.01] transition"
          >
            <CardContent className="pt-6">

              <div className="flex justify-between gap-6">
                <div className="flex gap-4">
                  
                  {/* ICON WITH COLORED BG */}
                  <div
                    className={`p-4 rounded-xl shadow-sm ${getCouponColor(
                      coupon.type
                    )}`}
                  >
                    {getCouponIcon(coupon.type)}
                  </div>

                  {/* COUPON INFO */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">{coupon.code}</h3>
                      <Badge
                        variant={coupon.isActive ? "default" : "secondary"}
                        className="rounded-lg"
                      >
                        {coupon.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground">{coupon.description}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="block text-muted-foreground">Discount:</span>
                        <b>
                          {coupon.type === "percentage"
                            ? `${coupon.discount}%`
                            : `$${coupon.discount}`}
                        </b>
                      </div>

                      {coupon.minOrder && (
                        <div>
                          <span className="block text-muted-foreground">Min Order:</span>
                          <b>${coupon.minOrder}</b>
                        </div>
                      )}

                      {coupon.maxDiscount && (
                        <div>
                          <span className="block text-muted-foreground">Max Discount:</span>
                          <b>${coupon.maxDiscount}</b>
                        </div>
                      )}

                      <div>
                        <span className="block text-muted-foreground">Type:</span>
                        <b className="capitalize">{coupon.type}</b>
                      </div>
                    </div>

                    {/* ACTIVE SWITCH */}
                    <div className="flex items-center gap-3 mt-3">
                      <Switch
                        checked={coupon.isActive}
                        onCheckedChange={(val:any) => handleToggleCoupon(coupon._id, val)}
                      />
                      <span className="text-sm">
                        {coupon.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEditCoupon(coupon)}>
                    <Edit className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDeleteCoupon(coupon._id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {coupons.length === 0 && (
        <Card className="border shadow-md rounded-xl">
          <CardContent className="py-12 text-center">
            <Tag className="h-16 w-16 text-muted-foreground mx-auto" />
            <h3 className="mt-4 mb-2 text-xl font-semibold">No Coupons Yet</h3>
            <p className="text-muted-foreground">Create your first promotional offer</p>
            <Button className="mt-4" onClick={() => setIsAddingCoupon(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Coupon
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
