"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Phone, User, Plus, Pencil,
  Trash2, Star, Home, Briefcase,
  MoreHorizontal, Check, X, LocateFixed, Loader2,
} from "lucide-react";
import { useAddressStore } from "@/store/addressStore";
import { useAuthStore } from "@/store/authStore";
import { useHydrateAddresses } from "@/lib/api/hooks/useHydrateAddresses";
import { useGeolocation } from "@/lib/geo/useGeolocation";
import type { Address } from "@/lib/address/types";

const LABELS = ["Home", "Work", "Other"] as const;

const LabelIcon = ({ label }: { label: string }) => {
  if (label === "Home") return <Home className="h-4 w-4" />;
  if (label === "Work") return <Briefcase className="h-4 w-4" />;
  return <MoreHorizontal className="h-4 w-4" />;
};

const emptyForm = {
  label: "Home" as string,
  recipientName: "",
  phone: "",
  addressLines: "",
  city: "",
  state: "",
  pinCode: "",
  landmark: "",
  deliveryInstructions: "",
  isDefault: false,
  lat: undefined as number | undefined,
  lng: undefined as number | undefined,
};

export function AddressBook() {
  const { user } = useAuthStore();
  const { addresses, addAddress, updateAddress, deleteAddress, setDefault } = useAddressStore();
  useHydrateAddresses();
  const geo = useGeolocation();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const openAdd = () => {
    setForm({
      ...emptyForm,
      recipientName: user?.name || "",
      phone: user?.phone || "",
      isDefault: addresses.length === 0,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (addr: Address) => {
    setForm({
      label: addr.label,
      recipientName: addr.recipientName,
      phone: addr.phone,
      addressLines: addr.addressLines,
      city: addr.city,
      state: addr.state,
      pinCode: addr.pinCode,
      landmark: addr.landmark || "",
      deliveryInstructions: addr.deliveryInstructions || "",
      isDefault: addr.isDefault,
      lat: addr.lat,
      lng: addr.lng,
    });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handlePhoneChange = (val: string) => {
    setForm((f) => ({ ...f, phone: val.replace(/[^0-9\s\+\-\(\)]/g, "") }));
  };

  const hasCoords = form.lat !== undefined && form.lng !== undefined;

  const canSubmit = Boolean(
    form.recipientName.trim() &&
    form.phone.trim() &&
    form.addressLines.trim() &&
    form.city.trim() &&
    form.state.trim() &&
    form.pinCode.trim() &&
    hasCoords,
  );

  const handleSubmit = async () => {
    if (!canSubmit || form.lat === undefined || form.lng === undefined) return;
    const payload = {
      label: form.label,
      recipientName: form.recipientName.trim(),
      phone: form.phone.trim(),
      addressLines: form.addressLines.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pinCode: form.pinCode.trim(),
      landmark: form.landmark.trim() || undefined,
      deliveryInstructions: form.deliveryInstructions.trim() || undefined,
      isDefault: form.isDefault,
      lat: form.lat,
      lng: form.lng,
    };
    if (editingId) {
      updateAddress(editingId, payload);
    } else {
      addAddress(payload);
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
                      value={form.recipientName}
                      onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
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
                    <MapPin className="h-3.5 w-3.5" /> Address Line *
                  </Label>
                  <Input
                    placeholder="123 Main Street, Apt 4B"
                    value={form.addressLines}
                    onChange={(e) => setForm((f) => ({ ...f, addressLines: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">City *</Label>
                    <Input
                      placeholder="City"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">State *</Label>
                    <Input
                      placeholder="State"
                      value={form.state}
                      onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">PIN / ZIP Code *</Label>
                    <Input
                      placeholder="000000"
                      value={form.pinCode}
                      onChange={(e) => setForm((f) => ({ ...f, pinCode: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Landmark (optional)</Label>
                  <Input
                    placeholder="Near the park"
                    value={form.landmark}
                    onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Delivery instructions (optional)</Label>
                  <Input
                    placeholder="Ring the bell twice"
                    value={form.deliveryInstructions}
                    onChange={(e) => setForm((f) => ({ ...f, deliveryInstructions: e.target.value }))}
                  />
                </div>

                {/* Coordinate capture */}
                <div className="space-y-2 rounded-lg border-2 border-dashed p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-sm">
                      <LocateFixed className="h-4 w-4 text-muted-foreground" />
                      {hasCoords ? (
                        <span className="text-foreground">
                          Location captured ({form.lat!.toFixed(4)}, {form.lng!.toFixed(4)})
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Coordinates required to save (server needs delivery coordinates)
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={geo.request}
                      disabled={geo.status === "prompting"}
                      className="gap-1.5"
                    >
                      {geo.status === "prompting" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LocateFixed className="h-3.5 w-3.5" />
                      )}
                      Use my location
                    </Button>
                  </div>
                  {geo.coords && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setForm((f) => ({ ...f, lat: geo.coords!.lat, lng: geo.coords!.lng }))}
                    >
                      Apply captured location
                    </Button>
                  )}
                  {(geo.status === "denied" || geo.status === "unavailable" || geo.status === "error") && (
                    <p className="text-xs text-destructive">{geo.error}</p>
                  )}
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
                  <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
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

      {/* Empty state */}
      {addresses.length === 0 && !showForm && (
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
      {addresses.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {addresses.map((addr, index) => (
              <motion.div
                key={addr.id}
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
                          <p className="text-sm font-medium">{addr.recipientName}</p>
                          <p className="text-sm text-muted-foreground">{addr.phone}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {addr.addressLines}, {addr.city}, {addr.state} {addr.pinCode}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!addr.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground h-8"
                            onClick={() => setDefault(addr.id)}
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
                          onClick={() => deleteAddress(addr.id)}
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
