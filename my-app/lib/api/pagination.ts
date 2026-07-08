export interface NormalizedPage<T> {
  items: T[];
  nextCursor?: string | null;
  hasMore: boolean;
  total?: number;
}

interface CursorPage<T> {
  items?: T[];
  data?: T[];
  nextCursor?: string | null;
}

interface OffsetPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type RawPage<T> = T[] | CursorPage<T> | OffsetPage<T> | null | undefined;

function isOffsetPage<T>(
  raw: CursorPage<T> | OffsetPage<T>,
): raw is OffsetPage<T> {
  const candidate = raw as OffsetPage<T>;
  return (
    typeof candidate.total === "number" &&
    typeof candidate.limit === "number" &&
    typeof candidate.offset === "number"
  );
}

export function normalizePage<T>(raw: RawPage<T>): NormalizedPage<T> {
  if (raw == null) {
    return { items: [], hasMore: false };
  }

  if (Array.isArray(raw)) {
    return { items: raw, hasMore: false, total: raw.length };
  }

  if (isOffsetPage(raw)) {
    const items = raw.items ?? [];
    return {
      items,
      hasMore: raw.offset + items.length < raw.total,
      total: raw.total,
    };
  }

  const items = raw.items ?? raw.data ?? [];
  const nextCursor = raw.nextCursor ?? undefined;
  return {
    items,
    nextCursor,
    hasMore: Boolean(nextCursor),
  };
}
