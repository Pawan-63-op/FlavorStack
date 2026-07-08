"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useManageZone } from "@/lib/api/hooks/useOwnerCatalog";
import type { DeliveryZoneView, ZoneFeeTierInput } from "@/lib/api/adapters/restaurantOwner";
import { restaurantErrorMessage } from "./RestaurantForm";

/** One "lat,lng" pair per line — the simplest polygon input without a map widget. */
export function parsePolygonLines(text: string): { lat: number; lng: number }[] | null {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const points: { lat: number; lng: number }[] = [];
  for (const line of lines) {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length !== 2) return null;
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    points.push({ lat, lng });
  }
  return points;
}

export function validatePolygon(points: { lat: number; lng: number }[]): string | null {
  if (points.length < 3) return "A delivery zone needs at least 3 points";
  for (const point of points) {
    if (point.lat < -90 || point.lat > 90) return "Latitude must be between -90 and 90";
    if (point.lng < -180 || point.lng > 180) return "Longitude must be between -180 and 180";
  }
  return null;
}

interface DeliveryZoneEditorProps {
  restaurantId: string;
  zones: DeliveryZoneView[];
}

export function DeliveryZoneEditor({ restaurantId, zones }: DeliveryZoneEditorProps) {
  const [polygonText, setPolygonText] = useState("");
  const [tierText, setTierText] = useState(""); // "maxDistanceMeters,fee" per line
  const [minOrder, setMinOrder] = useState(0);
  const manageZone = useManageZone();

  const handleAdd = () => {
    const points = parsePolygonLines(polygonText);
    if (!points) {
      toast.error("Polygon must be lat,lng pairs, one per line");
      return;
    }
    const polygonError = validatePolygon(points);
    if (polygonError) {
      toast.error(polygonError);
      return;
    }

    const tiers: ZoneFeeTierInput[] = [];
    for (const line of tierText.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const [distance, fee] = line.split(",").map((p) => Number(p.trim()));
      if (Number.isNaN(distance) || Number.isNaN(fee)) {
        toast.error("Fee tiers must be maxDistanceMeters,fee per line");
        return;
      }
      tiers.push({ maxDistanceMeters: distance, fee });
    }
    if (tiers.length === 0) {
      toast.error("At least one fee tier is required");
      return;
    }

    manageZone.mutate(
      {
        id: restaurantId,
        input: { action: "ADD", polygon: points, feeMatrix: { tiers }, minOrder },
      },
      {
        onSuccess: () => {
          toast.success("Delivery zone added");
          setPolygonText("");
          setTierText("");
          setMinOrder(0);
        },
        onError: (error) => toast.error(restaurantErrorMessage(error)),
      },
    );
  };

  const handleRemove = (zoneId: string) => {
    manageZone.mutate(
      { id: restaurantId, input: { action: "REMOVE", zoneId } },
      {
        onSuccess: () => toast.success("Delivery zone removed"),
        onError: (error) => toast.error(restaurantErrorMessage(error)),
      },
    );
  };

  return (
    <div className="space-y-4">
      {zones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No delivery zones yet.</p>
      ) : (
        <ul className="space-y-2">
          {zones.map((zone) => (
            <li key={zone.id} className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{zone.polygon.length}-point zone</span>
                <Button variant="ghost" size="icon" onClick={() => handleRemove(zone.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Min order: {zone.formattedMinOrder}</p>
              <ul className="text-sm text-muted-foreground">
                {zone.tiers.map((tier, i) => (
                  <li key={i}>
                    Up to {tier.maxDistanceMeters}m → {tier.formattedFee}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 pt-2 border-t">
        <Label>Add delivery zone</Label>
        <Textarea
          placeholder={"Polygon points, one lat,lng pair per line (>=3)\n18.50,73.80\n18.55,73.85\n18.52,73.90"}
          rows={4}
          value={polygonText}
          onChange={(e) => setPolygonText(e.target.value)}
        />
        <Textarea
          placeholder={"Fee tiers, one maxDistanceMeters,fee per line\n3000,20\n8000,40"}
          rows={3}
          value={tierText}
          onChange={(e) => setTierText(e.target.value)}
        />
        <div>
          <Label>Minimum order</Label>
          <Input
            type="number"
            value={minOrder}
            onChange={(e) => setMinOrder(parseFloat(e.target.value) || 0)}
          />
        </div>
        <Button onClick={handleAdd} disabled={manageZone.isPending} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Add zone
        </Button>
      </div>
    </div>
  );
}
