import Constants from "expo-constants";
import { Platform } from "react-native";

type Extra = {
  apiBaseUrl?: string;
  apiKey?: string;
  tenantId?: string;
  entityType?: string;
};

const extra = (Constants.expoConfig?.extra as Extra | undefined) ?? {};

/**
 * API base URL for the geo-tracking backend.
 *
 * Resolution order:
 *   1. `EXPO_PUBLIC_API_BASE_URL` env var (inlined from `.env.local` at build time).
 *   2. `expo.extra.apiBaseUrl` from app.json.
 *   3. `https://development.geo-tracking.ppruk.net` fallback.
 *
 * Android emulator fix: on Android, `localhost` / `127.0.0.1` point at the
 * emulator itself, so we automatically rewrite those to `10.0.2.2` for the
 * rare case a local mock server is pointed at.
 */
function resolveBase(): string {
  const raw =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    extra.apiBaseUrl ??
    "https://development.geo-tracking.ppruk.net";

  if (Platform.OS === "android") {
    return raw
      .replace("://localhost", "://10.0.2.2")
      .replace("://127.0.0.1", "://10.0.2.2");
  }
  return raw;
}

export const API_BASE_URL: string = resolveBase();

/**
 * Shared API key sent as `x-api-key` for every request to the geo-tracking
 * backend. Lives in `.env.local` (gitignored) so it isn't committed, and is
 * inlined into the bundle at build time via `EXPO_PUBLIC_API_KEY`.
 */
export const API_KEY: string =
  process.env.EXPO_PUBLIC_API_KEY ?? extra.apiKey ?? "";

/** Tenant identifier sent in every geo-tracking payload. */
export const TENANT_ID: string =
  process.env.EXPO_PUBLIC_TENANT_ID ?? extra.tenantId ?? "paperround";

/** Entity type sent in every geo-tracking payload. */
export const ENTITY_TYPE: string =
  process.env.EXPO_PUBLIC_ENTITY_TYPE ?? extra.entityType ?? "trunkingAgent";
