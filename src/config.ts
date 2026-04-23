import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * API base URL for the mock-express backend.
 *
 * Resolution order:
 *   1. `EXPO_PUBLIC_API_BASE_URL` env var (inlined at build time).
 *   2. `expo.extra.apiBaseUrl` from app.json.
 *   3. `http://localhost:3000` fallback for simulators.
 *
 * Android emulator fix: on Android, `localhost` / `127.0.0.1` point at the
 * emulator itself, so we automatically rewrite those to `10.0.2.2`, which is
 * the emulator's alias for the host machine.
 *
 * NOTE: Physical devices cannot reach `localhost` or `10.0.2.2` — use your
 * Mac's LAN IP (e.g. `http://192.168.1.42:3000`) via `EXPO_PUBLIC_API_BASE_URL`.
 */
function resolveBase(): string {
  const raw =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
    "http://localhost:3000";

  if (Platform.OS === "android") {
    return raw
      .replace("://localhost", "://10.0.2.2")
      .replace("://127.0.0.1", "://10.0.2.2");
  }
  return raw;
}

export const API_BASE_URL: string = resolveBase();
