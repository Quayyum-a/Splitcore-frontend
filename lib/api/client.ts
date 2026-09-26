import "server-only";

/**
 * The single point of contact with the Splitcore backend.
 *
 * WHY SERVER-ONLY: the deployed backend returns HTTP 500 for any request that
 * carries an `Origin` header — every browser origin, including localhost
 * (docs/api-audit.md §4). Server-side fetch sends no `Origin`, which is the
 * exact case the backend allows. Routing every call through our own server
 * therefore makes the app work today, keeps the JWT out of reach of client JS,
 * and keeps the backend URL out of the client bundle.
 *
 * Never import this from a "use client" module.
 */

export const API_BASE_URL = (
  process.env.API_BASE_URL ?? "https://splitcore-api.onrender.com"
).replace(/\/+$/, "");

/** An error carrying the backend's real HTTP status, so callers can branch on 404 vs 410. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;

  constructor(status: number, message: string, code = "ApiError", body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }

  /** True when the backend was unreachable rather than returning a response. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

interface BackendErrorBody {
  statusCode?: number;
  error?: string;
  message?: string | string[];
}

function extractMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null) {
    const { message } = body as BackendErrorBody;
    if (Array.isArray(message) && message.length > 0) return message.join(", ");
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
  /** Next.js fetch caching. Defaults to no-store: this data is live money data. */
  cache?: RequestCache;
  revalidate?: number | false;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Render's free tier cold-starts, so the default timeout is generous.
 * Callers on the guest hot path pass a shorter one.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    token,
    cache = "no-store",
    revalidate,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: revalidate === undefined ? cache : undefined,
      next: revalidate === undefined ? undefined : { revalidate },
    });
  } catch (cause) {
    const aborted = cause instanceof Error && cause.name === "AbortError";
    throw new ApiError(
      0,
      aborted
        ? "The Splitcore API did not respond in time."
        : "Could not reach the Splitcore API.",
      aborted ? "Timeout" : "NetworkError",
      null,
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  const raw = await response.text();
  let parsed: unknown = null;
  if (raw.length > 0) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }

  if (!response.ok) {
    const fallback =
      typeof parsed === "string" && parsed.length > 0 ? parsed : response.statusText;
    throw new ApiError(
      response.status,
      extractMessage(parsed, fallback || `Request failed with ${response.status}`),
      typeof parsed === "object" && parsed !== null
        ? ((parsed as BackendErrorBody).error ?? "ApiError")
        : "ApiError",
      parsed,
    );
  }

  return parsed as T;
}
