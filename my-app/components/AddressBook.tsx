"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Phone, User, Plus, Pencil,
  Trash2, Star, Home, Briefcase,
  MoreHorizontal, Check, X, Loader2,
} from "lucide-react";
import { useAddressStore, type Address } from "@/store/addressStore";
import { useAuthStore } from "@/store/authStore";

const LABELS = ["Home", "Work", "Other"] as const;

const LabelIcon = ({ label }: { label: string }) => {
  if (label === "Home") return <Home className="h-4 w-4" />;
  if (label === "Work") return <Briefcase className="h-4 w-4" />;
  return <MoreHorizontal className="h-4 w-4" />;
};

const emptyForm = {
  label: "Home" as string,
  name: "",
  phone: "",
  address: "",
  isDefault: false,
};

export function AddressBook() {
  const { user } = useAuthStore();
  const { addresses, isLoading, fetchAddresses, addAddress, updateAddress, deleteAddress, setDefault } =
    useAddressStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    fetchAddresses();
  }, []);

  const openAdd = () => {
    setForm({
      ...emptyForm,
      name: user?.name || "",
      phone: user?.phone || "",
      isDefault: addresses.length === 0,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (addr: Address) => {
    setForm({
      label: addr.label,
      name: addr.name,
      phone: addr.phone,
      address: addr.address,
      isDefault: addr.isDefault,
    });
    setEditingId(addr._id);
    setShowForm(true);
  };

  const handlePhoneChange = (val: string) => {
    setForm((f) => ({ ...f, phone: val.replace(/[^0-9\s\+\-\(\)]/g, "") }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) return;
    if (editingId) {
      await updateAddress(editingId, form);
    } else {
      await addAddress(form);
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Address Book</h1>
              <p className="text-sm text-muted-foreground">
                Saved addresses for faster checkout
              </p>
            </div>
          </div>
          {!showForm && (
            <Button onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" /> Add Address
            </Button>
          )}
        </div>
      </motion.div>

      {/* Add / Edit form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="border-2 border-primary/30 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">
                  {editingId ? "Edit Address" : "New Address"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Label */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Label</Label>
                  <div className="flex gap-2">
                    {LABELS.map((l) => (
                      <Button
                        key={l}
                        size="sm"
                        variant={form.label === l ? "default" : "outline"}
                        onClick={() => setForm((f) => ({ ...f, label: l }))}
                        className="gap-1.5"
                      >
                        <LabelIcon label={l} /> {l}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3.5 w-3.5" /> Full Name *
                    </Label>
                    <Input
                      placeholder="John Doe"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> Phone *
                    </Label>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={form.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      maxLength={15}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> Delivery Address *
                  </Label>
                  <Input
                    placeholder="123 Main Street, Apt 4B, City"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>

                {/* Default checkbox */}
                <div
                  className="flex items-center gap-2 cursor-pointer select-none"
                  onClick={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}
                >
                  <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                    form.isDefault ? "bg-primary border-primary" : "border-muted-foreground"
                  }`}>
                    {form.isDefault && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className="text-sm">Set as default address</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSubmit} className="gap-2">
                    <Check className="h-4 w-4" />
                    {editingId ? "Save Changes" : "Save Address"}
                  </Button>
                  <Button variant="outline" onClick={handleCancel} className="gap-2">
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && addresses.length === 0 && !showForm && (
        <Card className="border-2 border-dashed">
          <CardContent className="py-16 text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No saved addresses</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Save an address to speed up checkout next time.
            </p>
            <Button onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" /> Add your first address
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Address list */}
      {!isLoading && addresses.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {addresses.map((addr, index) => (
              <motion.div
                key={addr._id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className={`border-2 transition-all ${
                  addr.isDefault ? "border-primary/40 bg-primary/5" : "hover:border-border"
                }`}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-accent rounded-lg mt-0.5 shrink-0">
                          <LabelIcon label={addr.label} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold">{addr.label}</span>
                            {addr.isDefault && (
                              <Badge className="gap-1 text-xs">
                                <Star className="h-2.5 w-2.5 fill-current" /> Default
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium">{addr.name}</p>
                          <p className="text-sm text-muted-foreground">{addr.phone}</p>
                          <p className="text-sm text-muted-foreground truncate">{addr.address}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!addr.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground h-8"
                            onClick={() => setDefault(addr._id)}
                          >
                            Set default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(addr)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteAddress(addr._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {!showForm && (
            <Button variant="outline" onClick={openAdd} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Add Another Address
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
