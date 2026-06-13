export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor?: string;
}
