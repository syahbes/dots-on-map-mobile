import { API_BASE_URL, API_KEY } from "@/config";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly payload: unknown;

  constructor(status: number, code: string | null, message: string, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Thin fetch wrapper for the geo-tracking backend.
 *
 * Every request automatically carries the shared `x-api-key` header that the
 * backend requires. There's no user-specific auth token right now — the user
 * identity is expressed by the `entityId` in each payload.
 */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = opts;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-api-key": API_KEY,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const url = `${API_BASE_URL}${path}`;
  // DEV logging: print every outgoing request so we can verify the body
  // matches what the backend expects while we have no dashboard access.
  console.log(`[api] → ${method} ${url}`, body ?? "(no body)");

  const startedAt = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    console.warn(
      `[api] ✕ ${method} ${url} — network error after ${Date.now() - startedAt}ms`,
      err,
    );
    throw err;
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  const durationMs = Date.now() - startedAt;
  if (res.ok) {
    console.log(
      `[api] ← ${res.status} ${method} ${url} (${durationMs}ms)`,
      parsed ?? "(empty body)",
    );
    return parsed as T;
  }

  console.warn(
    `[api] ← ${res.status} ${method} ${url} (${durationMs}ms)`,
    parsed ?? "(empty body)",
  );

  const errorCode =
    parsed && typeof parsed === "object" && "error" in parsed
      ? String((parsed as { error: unknown }).error ?? "")
      : null;
  const errorMessage =
    parsed && typeof parsed === "object" && "message" in parsed
      ? String((parsed as { message: unknown }).message ?? "")
      : errorCode ?? `HTTP ${res.status}`;

  throw new ApiError(res.status, errorCode, errorMessage, parsed);
}
