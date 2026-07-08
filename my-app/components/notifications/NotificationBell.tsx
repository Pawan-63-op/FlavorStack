"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationDropdown } from "./NotificationDropdown";
import { useUnreadCount } from "@/lib/api/hooks/useNotifications";

/** Caps the badge so a large unread count never blows out the header layout. */
export function formatUnreadBadge(count: number): string {
  return count > 9 ? "9+" : String(count);
}

/**
 * Header notification affordance (Batch 8.2): a bell button with an absolute
 * unread badge (mirrors the cart-badge pattern in `Layout_comp`) that opens the
 * recent-notifications dropdown. The unread count polls + refetches on focus via
 * {@link useUnreadCount}. Rendered only behind the `notifications` flag by the
 * caller, so the whole affordance disappears when the flag is off.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: unreadCount } = useUnreadCount();
  const count = unreadCount ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {formatUnreadBadge(count)}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="p-0">
        <NotificationDropdown onNavigate={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
