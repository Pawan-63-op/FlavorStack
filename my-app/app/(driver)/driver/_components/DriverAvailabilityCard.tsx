"use client";

import { Loader2, Power } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useSetAvailability } from "@/lib/api/hooks/useDriver";

/**
 * Driver presence toggle (Phase 14.4) — go online/offline via
 * `PATCH /users/me/availability`. `isOnline` is owned by the parent page (the
 * single source of presence truth shared with the queue's `enabled` gate); this
 * card only renders it and reports the confirmed new value back on success.
 */
export function DriverAvailabilityCard({
  isOnline,
  onOnlineChange,
}: {
  isOnline: boolean;
  onOnlineChange: (next: boolean) => void;
}) {
  const setAvailability = useSetAvailability();

  const toggle = (next: boolean) => {
    setAvailability.mutate(next, {
      onSuccess: (presence) => {
        onOnlineChange(presence.isOnline);
        toast.success(presence.isOnline ? "You're online." : "You're offline.");
      },
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Could not update availability."),
    });
  };

  return (
    <Card className="border-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Power className="h-4 w-4 text-primary" />
          Availability
        </CardTitle>
        <Badge variant={isOnline ? "default" : "secondary"}>
          {isOnline ? "Online" : "Offline"}
        </Badge>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {isOnline
            ? "You're receiving delivery offers."
            : "Go online to start receiving delivery offers."}
        </p>
        <div className="flex items-center gap-2">
          {setAvailability.isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <Switch
            checked={isOnline}
            disabled={setAvailability.isPending}
            onCheckedChange={toggle}
            aria-label="Toggle availability"
          />
        </div>
      </CardContent>
    </Card>
  );
}
