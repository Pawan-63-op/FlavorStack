import { normalizeError } from "../errors/normalizeError";
import type { HttpMethod, RawRequestOptions, RequestOptions } from "./types";
import { createRefreshingRequest } from "./withRefresh";

const DEFAULT_BASE_URL = "/api/v1";
const MAX_RAW_BODY_BYTES = 5 * 1024 * 1024;

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL;
}

function buildUrl(path: string): string {
  const base = getBaseUrl().replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function generateRequestId(): string {
  return crypto.randomUUID();
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    throw normalizeError(err);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const parsed = await parseBody(response);

  if (!response.ok) {
    throw normalizeError(response.status, parsed, response.headers);
  }

  return parsed as T;
}

export async function request<T>(
  method: HttpMethod,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "x-request-id": generateRequestId(),
    ...opts.headers,
  };

  const init: RequestInit = {
    method,
    credentials: "include",
    headers,
    signal: opts.signal,
  };

  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }

  return send<T>(buildUrl(path), init);
}

function getBodyByteLength(body: BodyInit): number | undefined {
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  return undefined;
}

export async function rawRequest<T>(
  method: HttpMethod,
  path: string,
  opts: RawRequestOptions,
): Promise<T> {
  const size = getBodyByteLength(opts.body);
  if (size !== undefined && size > MAX_RAW_BODY_BYTES) {
    throw normalizeError(413, {
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: `Request body of ${size} bytes exceeds the ${MAX_RAW_BODY_BYTES} byte limit`,
      },
    });
  }

  const headers: Record<string, string> = {
    "x-request-id": generateRequestId(),
    "Content-Type": opts.contentType,
    ...opts.headers,
  };

  const init: RequestInit = {
    method,
    credentials: "include",
    headers,
    body: opts.body,
    signal: opts.signal,
  };

  return send<T>(buildUrl(path), init);
}

/**
 * Transport with transparent single-flight 401→refresh recovery. Built from
 * the raw {@link request} so the refresh POST it issues is never itself
 * intercepted (no recursion).
 */
const refreshingRequest = createRefreshingRequest(request);

export const client = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "body">) =>
    refreshingRequest<T>("GET", path, opts),
  post: <T>(path: string, opts?: RequestOptions) =>
    refreshingRequest<T>("POST", path, opts),
  patch: <T>(path: string, opts?: RequestOptions) =>
    refreshingRequest<T>("PATCH", path, opts),
  put: <T>(path: string, opts?: RequestOptions) =>
    refreshingRequest<T>("PUT", path, opts),
  del: <T>(path: string, opts?: RequestOptions) =>
    refreshingRequest<T>("DELETE", path, opts),
  raw: rawRequest,
};
