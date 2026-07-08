export type ApiErrorCategory =
  | "validation"
  | "auth"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "rateLimit"
  | "server"
  | "network";

const STATUS_CATEGORY_MAP: Record<number, ApiErrorCategory> = {
  401: "auth",
  403: "forbidden",
  404: "notFound",
  409: "conflict",
  422: "validation",
  429: "rateLimit",
};

export interface ApiErrorOptions {
  /** HTTP status code; omitted for network failures (no response received). */
  status?: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;
  raw?: unknown;
}

export class ApiError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;
  readonly requestId?: string;
  readonly raw?: unknown;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors;
    this.requestId = options.requestId;
    this.raw = options.raw;
  }

  get category(): ApiErrorCategory {
    if (this.status === undefined) return "network";
    if (this.status >= 500) return "server";
    return STATUS_CATEGORY_MAP[this.status] ?? "server";
  }
}
