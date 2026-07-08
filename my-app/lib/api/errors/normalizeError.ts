import { ApiError } from "./ApiError";

interface ZodLikeIssue {
  path: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractFieldErrors(details: unknown): Record<string, string> | undefined {
  if (!Array.isArray(details)) return undefined;

  const fieldErrors: Record<string, string> = {};
  for (const issue of details as unknown[]) {
    if (!isRecord(issue)) continue;
    const { path, message } = issue as Partial<ZodLikeIssue>;
    if (typeof path === "string" && typeof message === "string") {
      fieldErrors[path] = message;
    }
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

function normalizeHttpError(
  status: number,
  body: unknown,
  headers?: Headers,
): ApiError {
  const record = isRecord(body) ? body : undefined;
  const errorBody = record && isRecord(record.error) ? record.error : undefined;

  const code =
    typeof errorBody?.code === "string"
      ? errorBody.code
      : typeof record?.code === "string"
        ? record.code
        : "UNKNOWN_ERROR";

  const message =
    typeof errorBody?.message === "string"
      ? errorBody.message
      : typeof record?.message === "string"
        ? record.message
        : `Request failed with status ${status}`;

  const requestId =
    typeof errorBody?.requestId === "string"
      ? errorBody.requestId
      : headers?.get("x-request-id") ?? undefined;

  const fieldErrors = extractFieldErrors(errorBody?.details);

  return new ApiError({ status, code, message, fieldErrors, requestId, raw: body });
}

function normalizeNetworkError(error: unknown): ApiError {
  const message = error instanceof Error ? error.message : "Network error";
  return new ApiError({
    code: "NETWORK_ERROR",
    message,
    raw: error,
  });
}

export function normalizeError(status: number, body: unknown, headers?: Headers): ApiError;
export function normalizeError(networkError: unknown): ApiError;
export function normalizeError(
  statusOrError: unknown,
  body?: unknown,
  headers?: Headers,
): ApiError {
  if (typeof statusOrError === "number") {
    return normalizeHttpError(statusOrError, body, headers);
  }
  return normalizeNetworkError(statusOrError);
}
