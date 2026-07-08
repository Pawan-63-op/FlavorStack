"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { NotificationChannel } from "@/lib/api/adapters/notification";
import {
  PREFERENCE_CATEGORIES,
  type PreferenceChannelMap,
} from "@/lib/api/adapters/notificationPreferences";

/**
 * Per-category × per-channel preference grid (Batch 8.3). Controlled: the parent
 * screen owns the draft {@link PreferenceChannelMap} and applies each toggle via
 * the exported pure {@link toggleChannel} helper, keeping branching logic out of
 * the render and unit-testable without a DOM renderer.
 */

/** Immutably set one category/channel toggle, returning a new map. */
export function toggleChannel(
  channels: PreferenceChannelMap,
  category: keyof PreferenceChannelMap,
  channel: NotificationChannel,
  value: boolean,
): PreferenceChannelMap {
  const key = channel === "PUSH" ? "push" : "email";
  return {
    ...channels,
    [category]: { ...channels[category], [key]: value },
  };
}

interface PreferenceTogglesProps {
  channels: PreferenceChannelMap;
  onChange: (next: PreferenceChannelMap) => void;
  disabled?: boolean;
}

export function PreferenceToggles({ channels, onChange, disabled }: PreferenceTogglesProps) {
  return (
    <div className="divide-y">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-6 px-1 py-2 text-xs font-medium text-muted-foreground">
        <span>Category</span>
        <span className="w-12 text-center">Push</span>
        <span className="w-12 text-center">Email</span>
      </div>

      {PREFERENCE_CATEGORIES.map(({ category, label }) => {
        const toggle = channels[category];
        return (
          <div
            key={category}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-6 px-1 py-4"
          >
            <Label className="text-sm">{label}</Label>
            <span className="flex w-12 justify-center">
              <Switch
                checked={toggle.push}
                disabled={disabled}
                aria-label={`${label} push`}
                onCheckedChange={(value) =>
                  onChange(toggleChannel(channels, category, "PUSH", value))
                }
              />
            </span>
            <span className="flex w-12 justify-center">
              <Switch
                checked={toggle.email}
                disabled={disabled}
                aria-label={`${label} email`}
                onCheckedChange={(value) =>
                  onChange(toggleChannel(channels, category, "EMAIL", value))
                }
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
