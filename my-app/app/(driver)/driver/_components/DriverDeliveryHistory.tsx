"use client";

import { History, PackageCheck, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRiderDeliveryHistory } from "@/lib/api/hooks/useDriver";

/**
 * Driver completed-delivery history + earnings (Phase 15 / G19). Reads
 * `GET /riders/me/deliveries` (the rider queue drops terminal items, so history
 * comes from the retained admin projection). Shows lifetime totals up top and a
 * per-delivery list below, and refreshes when a delivery completes (the complete
 * mutation invalidates this query).
 */
export function DriverDeliveryHistory() {
  const query = useRiderDeliveryHistory();
  const history = query.data;

  return (
    <Card className="border-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" />
          Delivery history &amp; earnings
        </CardTitle>
        {history && (
          <Badge variant="secondary" className="gap-1">
            <PackageCheck className="h-3 w-3" />
            {history.totalDeliveries}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading your history…</p>
        ) : query.isError ? (
          <p className="py-6 text-center text-sm text-destructive">
            Couldn&apos;t load your delivery history.
          </p>
        ) : !history || history.deliveries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Wallet className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No completed deliveries yet. Your earnings will show up here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-accent/40 p-3">
                <p className="text-xs text-muted-foreground">Total earned</p>
                <p className="text-lg font-semibold">{history.formattedTotalEarnings}</p>
              </div>
              <div className="rounded-lg border bg-accent/40 p-3">
                <p className="text-xs text-muted-foreground">Deliveries</p>
                <p className="text-lg font-semibold">{history.totalDeliveries}</p>
              </div>
            </div>

            <ul className="divide-y">
              {history.deliveries.map((d) => (
                <li
                  key={d.fulfillmentId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      Order #{d.fulfillmentId.slice(-6)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.formattedDeliveredAt} · Order {d.formattedTotal}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold text-emerald-600">
                      +{d.formattedEarning}
                    </span>
                    <Badge variant="outline" className="mt-0.5 text-[10px]">
                      {d.statusLabel}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
