import { fetchAuthSession } from "aws-amplify/auth";

import { API_BASE_URL, API_KEY } from "@/config";

/**
 * Fetch the current Cognito access token. Amplify transparently refreshes it
 * from the refresh token if it's expired (default: 60-minute access tokens,
 * 30-day refresh tokens). Returns `null` when the user isn't signed in — the
 * caller can decide whether that's fatal.
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();
    return token ?? null;
  } catch (err) {
    console.warn("[api] fetchAuthSession failed — sending request without auth", err);
    return null;
  }
}

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
 * Every request carries two credentials (transitional — the backend is still
 * gating on `x-api-key` until JWT verification is wired up):
 *   - `x-api-key: <shared key>` — the existing coarse gate, and
 *   - `Authorization: Bearer <cognito-access-token>` — a JWT the backend
 *     will eventually verify against the Cognito pool's JWKS and trust
 *     `claims.sub` as the caller identity.
 */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = opts;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-api-key": API_KEY,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  // Attach the Cognito access token as a Bearer credential. The backend
  // verifies it against the pool's JWKS and trusts `claims.sub` as the
  // caller's identity. If there's no session we let the request go out
  // unauthenticated and let the backend 401 — that's a cleaner failure mode
  // than silently dropping the request.
  const accessToken = await getAccessToken();
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const url = `${API_BASE_URL}${path}`;
  // DEV logging: print every outgoing request so we can verify the body
  // matches what the backend expects while we have no dashboard access.
  console.log(
    `[api] → ${method} ${url} auth=${accessToken ? "bearer" : "none"}`,
    body ?? "(no body)",
  );

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
