"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PreferenceToggles } from "@/components/notifications/PreferenceToggles";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/lib/api/hooks/useNotificationPreferences";
import {
  diffPreferences,
  type PreferenceChannelMap,
} from "@/lib/api/adapters/notificationPreferences";
import { ApiError } from "@/lib/api/errors/ApiError";
import { isEnabled } from "@/lib/config/featureFlags";

/**
 * Notification preferences screen (Batch 8.3) — a per-category × per-channel
 * toggle grid persisted via the diff-based `PUT`. The screen holds a draft of
 * the toggle state; "Save" computes the current→desired diff (skipped when
 * nothing changed, since the server rejects an empty diff) and re-reflects the
 * persisted state after the mutation invalidates the cache. Feature-flag gated.
 */
export default function NotificationPreferencesPage() {
  const { data, isLoading, isError } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const [draft, setDraft] = useState<PreferenceChannelMap | null>(null);
  const [seededFrom, setSeededFrom] = useState<string | null>(null);

  // Re-seed the draft whenever fresh server state arrives — keyed on the
  // server's `updatedAt`, which changes on initial load and after a successful
  // save invalidates + refetches — so the form mirrors what's persisted and the
  // dirty check resets. Adjusting state during render (guarded) is React's
  // recommended alternative to a sync-in-effect.
  if (data && data.updatedAt !== seededFrom) {
    setSeededFrom(data.updatedAt);
    setDraft(data.channels);
  }

  if (!isEnabled("notifications")) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="py-16 text-center text-muted-foreground">
          Notification preferences are not available.
        </p>
      </div>
    );
  }

  const dirty = data && draft ? diffPreferences(data.channels, draft).length > 0 : false;

  const handleSave = async () => {
    if (!data || !draft) return;
    try {
      await update.mutateAsync({ prev: data.channels, next: draft });
      toast.success("Preferences saved");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save preferences");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
          <CardDescription>
            Choose how you want to hear about orders, delivery, security, and promotions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!isLoading && isError && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              We couldn&apos;t load your preferences. Please try again.
            </p>
          )}

          {!isLoading && !isError && draft && (
            <>
              <PreferenceToggles
                channels={draft}
                onChange={setDraft}
                disabled={update.isPending}
              />
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={!dirty || update.isPending}>
                  {update.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
