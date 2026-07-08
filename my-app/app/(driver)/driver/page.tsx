"use client";

import { useState } from "react";
import { Bike } from "lucide-react";
import { DriverAvailabilityCard } from "./_components/DriverAvailabilityCard";
import { DriverQueue } from "./_components/DriverQueue";
import { DriverDeliveryHistory } from "./_components/DriverDeliveryHistory";

/**
 * Driver operational surface (Phase 14.4) — the rider's home screen, previously
 * curl/E2E-only. Presence (`isOnline`) is held here as the single source of
 * truth: the availability card writes it via `PATCH /users/me/availability`, and
 * the queue uses it to gate fetching/polling `GET /riders/me/queue`. The route
 * group is guarded for `role === "DRIVER"` by `app/(driver)/layout.tsx`.
 *
 * Presence is not yet exposed on `GET /users/me`, so it defaults to offline on
 * load and reflects the last confirmed toggle — the driver re-asserts online
 * each session, which also (re)registers them for offers.
 */
export default function DriverPage() {
  const [isOnline, setIsOnline] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <header className="flex items-center gap-3">
        <Bike className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Driver</h1>
          <p className="text-sm text-muted-foreground">Manage your availability and deliveries.</p>
        </div>
      </header>

      <DriverAvailabilityCard isOnline={isOnline} onOnlineChange={setIsOnline} />
      <DriverQueue isOnline={isOnline} />
      <DriverDeliveryHistory />
    </div>
  );
}
