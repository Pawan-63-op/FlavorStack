"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Store,
  UtensilsCrossed,
  Receipt,
  Users,
  Tag,
} from "lucide-react";
import { OverviewDashboard } from "@/admin_new/src/components/admin/OverviewDashboard";
import { RestaurantManagement } from "@/admin_new/src/components/admin/RestaurantManagement";
import { MenuManagement } from "@/admin_new/src/components/admin/MenuManagement";
import { CouponManagement } from "@/admin_new/src/components/admin/CouponManagement";
import { OrderManagement } from "@/admin_new/src/components/admin/OrderManagement";
import { UserManagement } from "@/admin_new/src/components/admin/UserManagement";
import { AdminChat } from "./admin/AdminChat";

export function AdminDashboard() {
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
          Manage restaurants, menus, orders, and view analytics
        </p>
      </motion.div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="Chats" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Chats</span>
          </TabsTrigger>
          <TabsTrigger value="restaurants" className="gap-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Restaurants</span>
          </TabsTrigger>
          <TabsTrigger value="menus" className="gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            <span className="hidden sm:inline">Menus</span>
          </TabsTrigger>
          <TabsTrigger value="coupons" className="gap-2">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Coupons</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Orders</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewDashboard />
        </TabsContent>
          <TabsContent value="Chats">
          <AdminChat />
        </TabsContent>
        <TabsContent value="restaurants">
          <RestaurantManagement />
        </TabsContent>

        <TabsContent value="menus">
          <MenuManagement />
        </TabsContent>

        <TabsContent value="coupons">
          <CouponManagement />
        </TabsContent>

        <TabsContent value="orders">
          <OrderManagement />
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
