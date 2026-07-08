"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/errors/ApiError";
import {
  useCancelFulfillment,
  useReassignFulfillment,
} from "@/lib/api/hooks/useFulfillmentAdmin";

export type FulfillmentActionMode = "reassign" | "cancel";

/** Cancel reason bound, mirrored from server_2's `cancelSchema` (1–500 chars). */
export const CANCEL_REASON_MAX = 500;

/** Trims an optional rider-id input — omitted (auto-pick) when blank. */
export function buildReassignRiderInput(riderId: string): string | undefined {
  const trimmed = riderId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Friendly, mode-aware error mapping for the reassign/cancel actions. Maps the
 * `no_available_rider` (409) reassign conflict and any cancel transition error
 * (`PICKED_UP`+ etc., surfaced as a conflict/validation) to a human message —
 * without hardcoding the server's exact wording. Other errors fall back to the
 * server's own message; non-`ApiError`s to a generic message.
 */
export function fulfillmentActionErrorMessage(mode: FulfillmentActionMode, error: unknown): string {
  if (error instanceof ApiError) {
    if (mode === "reassign" && error.code === "no_available_rider") {
      return "No rider currently available — try again shortly.";
    }
    if (mode === "cancel" && (error.category === "conflict" || error.category === "validation")) {
      return "This fulfillment can no longer be cancelled.";
    }
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

interface FulfillmentActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: FulfillmentActionMode;
  fulfillmentId: string;
}

export function FulfillmentActionDialog({
  open,
  onOpenChange,
  mode,
  fulfillmentId,
}: FulfillmentActionDialogProps) {
  const [riderId, setRiderId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reassign = useReassignFulfillment();
  const cancel = useCancelFulfillment();
  const isPending = reassign.isPending || cancel.isPending;

  // No reset effect needed: the parent mounts this dialog conditionally per
  // action, so transient state (rider/reason/error) starts fresh on each open.
  const cancelDisabled = mode === "cancel" && reason.trim().length === 0;

  const handleConfirm = () => {
    setError(null);
    if (mode === "reassign") {
      reassign.mutate(
        { id: fulfillmentId, riderId: buildReassignRiderInput(riderId) },
        {
          onSuccess: () => {
            toast.success("Fulfillment reassigned");
            onOpenChange(false);
          },
          onError: (err) => setError(fulfillmentActionErrorMessage("reassign", err)),
        },
      );
      return;
    }
    cancel.mutate(
      { id: fulfillmentId, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success("Fulfillment cancelled");
          onOpenChange(false);
        },
        onError: (err) => setError(fulfillmentActionErrorMessage("cancel", err)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "reassign" ? "Reassign rider" : "Cancel fulfillment"}
          </DialogTitle>
          <DialogDescription>
            {mode === "reassign"
              ? "Leave the rider blank to auto-pick the next available rider."
              : "This cancels the fulfillment. A reason is required (1–500 characters)."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {mode === "reassign" ? (
            <>
              <Label htmlFor="reassign-rider">Rider ID (optional)</Label>
              <Input
                id="reassign-rider"
                placeholder="Auto-pick next available"
                value={riderId}
                onChange={(e) => setRiderId(e.target.value)}
                disabled={isPending}
              />
            </>
          ) : (
            <>
              <Label htmlFor="cancel-reason">Reason</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Why is this being cancelled?"
                maxLength={CANCEL_REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
              />
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Close
          </Button>
          <Button
            variant={mode === "cancel" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isPending || cancelDisabled}
          >
            {isPending
              ? mode === "reassign"
                ? "Reassigning…"
                : "Cancelling…"
              : mode === "reassign"
                ? "Reassign"
                : "Cancel fulfillment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
