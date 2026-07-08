export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface RawRequestOptions {
  /** Binary payload; Blob/ArrayBuffer/TypedArray sizes are checked against the upload limit. */
  body: BodyInit;
  contentType: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}
