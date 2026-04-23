import { API_BASE_URL } from "@/config";
import { clearToken, getToken } from "@/auth/tokenStorage";

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
  auth?: boolean; // include Authorization header if token exists (default: true)
  signal?: AbortSignal;
};

type AuthFailureListener = () => void;
const authFailureListeners = new Set<AuthFailureListener>();

/** Subscribe to 401 responses so AuthContext can sign the user out. */
export function onAuthFailure(listener: AuthFailureListener): () => void {
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = opts;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (res.ok) {
    return parsed as T;
  }

  const errorCode =
    parsed && typeof parsed === "object" && "error" in parsed
      ? String((parsed as { error: unknown }).error ?? "")
      : null;
  const errorMessage =
    parsed && typeof parsed === "object" && "message" in parsed
      ? String((parsed as { message: unknown }).message ?? "")
      : errorCode ?? `HTTP ${res.status}`;

  if (res.status === 401) {
    await clearToken();
    authFailureListeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  }

  throw new ApiError(res.status, errorCode, errorMessage, parsed);
}
