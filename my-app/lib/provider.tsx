"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { ApiError, type ApiErrorCategory } from "./api/errors/ApiError";

const MAX_QUERY_RETRIES = 2;

/** Client-side (4xx) categories — never worth retrying; the request is wrong. */
const NON_RETRYABLE_CATEGORIES: ReadonlySet<ApiErrorCategory> = new Set([
  "validation",
  "auth",
  "forbidden",
  "notFound",
  "conflict",
  "rateLimit",
]);

/**
 * TanStack Query retry policy: never retry a 4xx `ApiError` (using its
 * `category`); retry transient failures (5xx / network / unknown) up to
 * {@link MAX_QUERY_RETRIES}. Exported for unit testing.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && NON_RETRYABLE_CATEGORIES.has(error.category)) {
    return false;
  }
  return failureCount < MAX_QUERY_RETRIES;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: shouldRetryQuery,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
