const FALLBACK_DISPLAY = "—";

const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 1000 * 60 * 60 * 24 * 365 },
  { unit: "month", ms: 1000 * 60 * 60 * 24 * 30 },
  { unit: "week", ms: 1000 * 60 * 60 * 24 * 7 },
  { unit: "day", ms: 1000 * 60 * 60 * 24 },
  { unit: "hour", ms: 1000 * 60 * 60 },
  { unit: "minute", ms: 1000 * 60 },
  { unit: "second", ms: 1000 },
];

function parseIso(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatDate(
  iso: string | null | undefined,
  locale = "en-US",
): string {
  const date = parseIso(iso);
  if (!date) return FALLBACK_DISPLAY;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    date,
  );
}

export function formatRelativeTime(
  iso: string | null | undefined,
  now: Date = new Date(),
  locale = "en-US",
): string {
  const date = parseIso(iso);
  if (!date) return FALLBACK_DISPLAY;

  const diffMs = date.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);

  if (absMs < 1000) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      0,
      "second",
    );
  }

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (absMs >= ms || unit === "second") {
      const value = Math.round(diffMs / ms);
      return formatter.format(value, unit);
    }
  }

  return formatter.format(0, "second");
}
