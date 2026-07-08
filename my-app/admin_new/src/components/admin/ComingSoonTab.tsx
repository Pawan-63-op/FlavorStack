"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface ComingSoonTabProps {
  title: string;
}

/** Disabled placeholder for tabs not yet wired to server_2 (Phase 11). */
export function ComingSoonTab({ title }: ComingSoonTabProps) {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
        <Clock className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          This section is coming soon — it will be wired up in Phase 11 (Admin operations).
        </p>
      </CardContent>
    </Card>
  );
}
