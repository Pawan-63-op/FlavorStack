"use client";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

/** Defense-in-depth fallback shown if a non-admin reaches a gated tab's content directly (Phase 11). */
export function AdminOnlyPanel() {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Admins only</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          You don&apos;t have access to this section.
        </p>
      </CardContent>
    </Card>
  );
}
