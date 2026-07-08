"use client";
import { useState } from "react";
import { Loader2, ShieldCheck, RefreshCw, Inbox, Users as UsersIcon, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/store/authStore";
import { useAdminDrivers, useVerifyDriver } from "@/lib/api/hooks/useAdminDrivers";
import { useAdminUsers, useBanUser, useUnbanUser } from "@/lib/api/hooks/useAdminUsers";
import type { AdminDriverSummary } from "@/lib/api/services/adminDrivers";
import type { AdminUserSummary } from "@/lib/api/services/adminUsers";
import { AdminOnlyPanel } from "./AdminOnlyPanel";

const ROLES = ["CUSTOMER", "DRIVER", "ADMIN"] as const;
const PAGE_SIZE = 10;

/**
 * Admin Users tab (Phase 14.3 → Phase 15 / G5 + G5 follow-up).
 *
 * Surfaces two one-click driver-verification sections, both backed by
 * `GET /admin/drivers?status=…` and the same `POST /admin/drivers/:id/verify`
 * endpoint (PENDING_VERIFICATION | SUSPENDED → OFFLINE):
 *  - **Pending driver verifications** — approve newly registered drivers.
 *  - **Suspended drivers** — re-verify a suspended driver (guarded by a
 *    confirmation dialog).
 * The paste-a-userId fallback card was removed: every verification path is now
 * one-click with no raw-id entry. Gated behind `user.isAdmin` (UX mitigation; the
 * endpoint is the real authority).
 */
export function UserManagement() {
  const isAdmin = useAuthStore((s) => s.user?.isAdmin) === true;

  if (!isAdmin) {
    return (
      <div className="space-y-6 mt-6">
        <h3>User Management</h3>
        <AdminOnlyPanel />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      <h3>User Management</h3>
      <DriverVerificationCard
        status="PENDING_VERIFICATION"
        title="Pending driver verifications"
        description="Approve newly registered drivers so they can go online and accept deliveries."
        actionLabel="Verify"
        emptyText="No drivers awaiting verification."
      />
      <DriverVerificationCard
        status="SUSPENDED"
        title="Suspended drivers"
        description="Re-verify a suspended driver to restore them to OFFLINE so they can go online again."
        actionLabel="Re-verify"
        emptyText="No suspended drivers."
        confirmReverify
      />
      <UsersBrowseCard />
    </div>
  );
}

function UsersBrowseCard() {
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const params = {
    page,
    limit: PAGE_SIZE,
    role: roleFilter === "ALL" ? undefined : roleFilter,
    search: search || undefined,
  };
  const { data, isLoading, isError, error, isFetching, refetch } = useAdminUsers(params);

  const unban = useUnbanUser();
  const [banTarget, setBanTarget] = useState<AdminUserSummary | null>(null);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const onUnban = (user: AdminUserSummary) => {
    unban.mutate(user.id, {
      onSuccess: () => toast.success(`${user.name} unbanned.`),
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Could not unban user."),
    });
  };

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UsersIcon className="h-5 w-5 text-primary" />
              All users
            </CardTitle>
            <CardDescription>
              Browse platform users; change roles or ban / unban accounts.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="user-search" className="text-xs text-muted-foreground">
              Search name or email
            </Label>
            <div className="flex gap-2">
              <Input
                id="user-search"
                className="w-64"
                placeholder="e.g. jane or jane@…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSearch();
                }}
              />
              <Button variant="secondary" onClick={onSearch}>
                Search
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                setPage(1);
                setRoleFilter(v);
              }}
            >
              <SelectTrigger className="w-40" aria-label="Filter by role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load users."}
          </p>
        ) : !data || data.users.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <p className="text-sm">No users match this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.isBanned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.isBanned ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onUnban(u)}
                          disabled={unban.isPending}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Unban
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setBanTarget(u)}
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          Ban
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {total} user{total === 1 ? "" : "s"} · page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>

      <BanDialog
        user={banTarget}
        onClose={() => setBanTarget(null)}
      />
    </Card>
  );
}

function BanDialog({ user, onClose }: { user: AdminUserSummary | null; onClose: () => void }) {
  const ban = useBanUser();
  const [reason, setReason] = useState("");

  const onConfirm = () => {
    if (!user) return;
    const r = reason.trim();
    if (!r) return;
    ban.mutate(
      { userId: user.id, reason: r },
      {
        onSuccess: () => {
          toast.success(`${user.name} banned.`);
          setReason("");
          onClose();
        },
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Could not ban user."),
      },
    );
  };

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban {user?.name}</DialogTitle>
          <DialogDescription>
            This revokes the user&apos;s sessions immediately. Provide a reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="ban-reason" className="text-xs text-muted-foreground">
            Reason
          </Label>
          <Input
            id="ban-reason"
            placeholder="e.g. Terms violation"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onConfirm();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={ban.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!reason.trim() || ban.isPending}>
            {ban.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ban user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One driver-verification section (G5 + G5 follow-up). Reused for both the
 * PENDING_VERIFICATION queue and the SUSPENDED list — both read
 * `GET /admin/drivers?status=…` and verify via the same endpoint. The header
 * shows a live count; suspended re-verifies route through a confirmation dialog
 * (`confirmReverify`). A successful action invalidates every `["admin","drivers"]`
 * query (see {@link useVerifyDriver}), so both sections refresh immediately.
 */
function DriverVerificationCard({
  status,
  title,
  description,
  actionLabel,
  emptyText,
  confirmReverify = false,
}: {
  status: string;
  title: string;
  description: string;
  actionLabel: string;
  emptyText: string;
  confirmReverify?: boolean;
}) {
  const { data: drivers, isLoading, isError, error, refetch, isFetching } =
    useAdminDrivers(status);
  const verify = useVerifyDriver();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdminDriverSummary | null>(null);

  const runVerify = (driver: AdminDriverSummary) => {
    setVerifyingId(driver.id);
    verify.mutate(driver.id, {
      onSuccess: (result) =>
        toast.success(`${driver.name} verified — status is now ${result.driverStatus}.`),
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Could not verify driver."),
      onSettled: () => {
        setVerifyingId(null);
        setConfirmTarget(null);
      },
    });
  };

  const onAction = (driver: AdminDriverSummary) => {
    if (confirmReverify) setConfirmTarget(driver);
    else runVerify(driver);
  };

  const count = drivers?.length ?? 0;

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {title}
              {drivers && (
                <Badge variant="secondary" className="ml-1">
                  {count}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load drivers."}
          </p>
        ) : !drivers || drivers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <p className="text-sm">{emptyText}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {drivers.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{d.name}</span>
                    <Badge variant="secondary">{d.driverStatus}</Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {d.email} · {d.phone}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.vehicle.type} · {d.vehicle.brand} {d.vehicle.model} · {d.vehicle.licensePlate}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onAction(d)}
                  disabled={verify.isPending && verifyingId === d.id}
                >
                  {verify.isPending && verifyingId === d.id && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {actionLabel}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-verify {confirmTarget?.name}?</DialogTitle>
            <DialogDescription>
              This restores the suspended driver to OFFLINE so they can go online and accept
              deliveries again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmTarget(null)}
              disabled={verify.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmTarget && runVerify(confirmTarget)}
              disabled={verify.isPending}
            >
              {verify.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
