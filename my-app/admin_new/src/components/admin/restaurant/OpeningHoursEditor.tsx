"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSetOpeningHours } from "@/lib/api/hooks/useOwnerCatalog";
import { WEEKDAYS, type Weekday } from "@/lib/api";
import type { WeeklyScheduleResponse } from "@/lib/api/adapters/restaurantOwner";
import { restaurantErrorMessage } from "./RestaurantForm";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateInterval(open: string, close: string): string | null {
  if (!TIME_PATTERN.test(open) || !TIME_PATTERN.test(close)) {
    return "Times must be in HH:mm format";
  }
  if (open >= close) {
    return "Close time must be after open time";
  }
  return null;
}

export function addHoliday(holidays: string[], date: string): string[] {
  return holidays.includes(date) ? holidays : [...holidays, date];
}

export function removeHoliday(holidays: string[], date: string): string[] {
  return holidays.filter((h) => h !== date);
}

function setDayIntervals(
  schedule: WeeklyScheduleResponse,
  day: Weekday,
  intervals: { open: string; close: string }[],
): WeeklyScheduleResponse {
  return { ...schedule, [day]: intervals };
}

interface OpeningHoursEditorProps {
  restaurantId: string;
  schedule: WeeklyScheduleResponse;
  holidays: string[];
}

export function OpeningHoursEditor({ restaurantId, schedule, holidays }: OpeningHoursEditorProps) {
  const [draftSchedule, setDraftSchedule] = useState(schedule);
  const [draftHolidays, setDraftHolidays] = useState(holidays);
  const [newHoliday, setNewHoliday] = useState("");
  const setOpeningHours = useSetOpeningHours();

  const handleAddInterval = (day: Weekday) => {
    const intervals = draftSchedule[day] ?? [];
    setDraftSchedule(setDayIntervals(draftSchedule, day, [...intervals, { open: "09:00", close: "17:00" }]));
  };

  const handleRemoveInterval = (day: Weekday, index: number) => {
    const intervals = (draftSchedule[day] ?? []).filter((_, i) => i !== index);
    setDraftSchedule(setDayIntervals(draftSchedule, day, intervals));
  };

  const handleIntervalChange = (day: Weekday, index: number, field: "open" | "close", value: string) => {
    const intervals = (draftSchedule[day] ?? []).map((interval, i) =>
      i === index ? { ...interval, [field]: value } : interval,
    );
    setDraftSchedule(setDayIntervals(draftSchedule, day, intervals));
  };

  const handleAddHoliday = () => {
    if (!newHoliday) return;
    setDraftHolidays(addHoliday(draftHolidays, newHoliday));
    setNewHoliday("");
  };

  const handleSave = () => {
    for (const day of WEEKDAYS) {
      for (const interval of draftSchedule[day] ?? []) {
        const error = validateInterval(interval.open, interval.close);
        if (error) {
          toast.error(`${day}: ${error}`);
          return;
        }
      }
    }
    setOpeningHours.mutate(
      { id: restaurantId, input: { schedule: draftSchedule, holidays: draftHolidays } },
      {
        onSuccess: () => toast.success("Opening hours saved"),
        onError: (error) => toast.error(restaurantErrorMessage(error)),
      },
    );
  };

  return (
    <div className="space-y-4">
      {WEEKDAYS.map((day) => (
        <div key={day} className="flex items-start gap-3">
          <span className="w-24 text-sm font-medium pt-2">{day.slice(0, 3)}</span>
          <div className="flex-1 space-y-2">
            {(draftSchedule[day] ?? []).map((interval, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="time"
                  value={interval.open}
                  onChange={(e) => handleIntervalChange(day, index, "open", e.target.value)}
                  className="w-32"
                />
                <span>–</span>
                <Input
                  type="time"
                  value={interval.close}
                  onChange={(e) => handleIntervalChange(day, index, "close", e.target.value)}
                  className="w-32"
                />
                <Button variant="ghost" size="icon" onClick={() => handleRemoveInterval(day, index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => handleAddInterval(day)}>
              <Plus className="h-3 w-3 mr-1" /> Add interval
            </Button>
          </div>
        </div>
      ))}

      <div className="space-y-2 pt-2 border-t">
        <Label>Holidays</Label>
        <div className="flex gap-2">
          <Input type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} />
          <Button variant="outline" onClick={handleAddHoliday}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {draftHolidays.map((date) => (
            <span key={date} className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
              {date}
              <button onClick={() => setDraftHolidays(removeHoliday(draftHolidays, date))}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={setOpeningHours.isPending} className="w-full">
        Save opening hours
      </Button>
    </div>
  );
}
