import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export function UserManagement() {
  return (
    <div className="space-y-6 mt-6">
      <h3>User Management</h3>
      <Card className="border-2 shadow-lg">
        <CardContent className="pt-12 pb-12 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="mb-2">User Management Coming Soon</h3>
          <p className="text-muted-foreground">
            Manage user accounts, permissions, and activity
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
