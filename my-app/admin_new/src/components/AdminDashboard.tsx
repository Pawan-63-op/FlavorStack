"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Store,
  UtensilsCrossed,
  Receipt,
  Users,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { isEnabled } from "@/lib/config/featureFlags";
import { useOwnerRestaurants } from "@/lib/api/hooks/useOwnerCatalog";
import { OverviewDashboard } from "@/admin_new/src/components/admin/OverviewDashboard";
import { RestaurantManagement } from "@/admin_new/src/components/admin/RestaurantManagement";
import { MenuManagement } from "@/admin_new/src/components/admin/MenuManagement";
import { UserManagement } from "@/admin_new/src/components/admin/UserManagement";
import { ComingSoonTab } from "@/admin_new/src/components/admin/ComingSoonTab";
import { AdminOnlyPanel } from "@/admin_new/src/components/admin/AdminOnlyPanel";
import { ReviewModerationQueue } from "@/admin_new/src/components/admin/reviews/ReviewModerationQueue";
import { FulfillmentDashboard } from "@/admin_new/src/components/admin/fulfillments/FulfillmentDashboard";
import { RestaurantQueue } from "@/admin_new/src/components/admin/fulfillments/RestaurantQueue";

export function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  // Gates the Phase 11 admin-ops tabs (Moderation, Fulfillments, ...) independently
  // of the existing `admin` flag — does not affect Restaurants/Menus/Orders/Users.
  const canSeeAdminOps = Boolean(user?.isAdmin) && isEnabled("adminOps");
  // The read-only prep Queue is owner-facing — visible to anyone with >=1 owned
  // restaurant (registry-derived), independent of `isAdmin`/`adminOps`.
  const { data: ownedRestaurants } = useOwnerRestaurants();
  const canSeeQueue = (ownedRestaurants?.length ?? 0) > 0;

  const visibleTabCount = 5 + (canSeeAdminOps ? 1 : 0) + (canSeeQueue ? 1 : 0);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <LayoutDashboard className="h-8 w-8 text-primary" />
          <h2>Admin Dashboard</h2>
        </div>
        <p className="text-muted-foreground">
          Manage the restaurants and menus you own
          {user ? ` — signed in as ${user.name} (${user.email})` : ""}
        </p>
      </motion.div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${visibleTabCount}, minmax(0, 1fr))` }}>
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="restaurants" className="gap-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Restaurants</span>
          </TabsTrigger>
          <TabsTrigger value="menus" className="gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            <span className="hidden sm:inline">Menus</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Orders</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          {canSeeAdminOps && (
            <TabsTrigger value="reviews-moderation" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Moderation</span>
            </TabsTrigger>
          )}
          {canSeeQueue && (
            <TabsTrigger value="queue" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Queue</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <OverviewDashboard />
        </TabsContent>

        <TabsContent value="restaurants">
          <RestaurantManagement />
        </TabsContent>

        <TabsContent value="menus">
          <MenuManagement />
        </TabsContent>

        <TabsContent value="orders">
          {canSeeAdminOps ? <FulfillmentDashboard /> : <ComingSoonTab title="Order management" />}
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="reviews-moderation">
          {canSeeAdminOps ? <ReviewModerationQueue /> : <AdminOnlyPanel />}
        </TabsContent>

        {canSeeQueue && (
          <TabsContent value="queue">
            <RestaurantQueue />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
