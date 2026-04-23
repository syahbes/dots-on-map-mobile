import { useAuth } from "@/auth/AuthContext";
import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { handleFix } from "./pipeline";
import {
  getPermissionSnapshot,
  isTrackingActive,
  requestBackground,
  requestForeground,
  startTracking,
  stopTracking,
  type PermissionSnapshot,
} from "./tracking";

type ToggleResult =
  | { ok: true }
  | {
      ok: false;
      reason: "foreground-denied" | "background-denied" | "error";
      error?: unknown;
    };

type TrackingContextValue = {
  isOn: boolean;
  permissions: PermissionSnapshot;
  /** Re-read permission status and registered-task state from the OS. */
  refresh: () => Promise<void>;
  /** Flip the switch. Returns result so the UI can show inline feedback. */
  setOn: (on: boolean) => Promise<ToggleResult>;
  /** Ask the user for background ("Always") permission explicitly. */
  requestBackgroundPermission: () => Promise<PermissionSnapshot>;
};

const DEFAULT_PERMS: PermissionSnapshot = {
  foreground: "undetermined" as PermissionSnapshot["foreground"],
  background: "undetermined" as PermissionSnapshot["background"],
  foregroundGranted: false,
  backgroundGranted: false,
};

const TrackingContext = createContext<TrackingContextValue | null>(null);

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus } = useAuth();
  const [isOn, setIsOn] = useState<boolean>(false);
  const [permissions, setPermissions] =
    useState<PermissionSnapshot>(DEFAULT_PERMS);
  const [appActive, setAppActive] = useState<boolean>(
    AppState.currentState === "active",
  );
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const refresh = useCallback(async () => {
    const [snap, active] = await Promise.all([
      getPermissionSnapshot(),
      isTrackingActive(),
    ]);
    setPermissions(snap);
    setIsOn(active);
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      setAppActive(state === "active");
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // When the user signs out (or the API client forces a sign-out after a 401),
  // AuthContext has already stopped the background task and cleared the queue;
  // here we just resync our local `isOn` state so the foreground watch
  // subscription also tears itself down.
  useEffect(() => {
    if (authStatus === "signed-out") {
      void refresh();
    }
  }, [authStatus, refresh]);

  // Foreground watch subscription.
  //
  // Why this exists in addition to the background task: on Android (especially
  // emulators) the background task consumer tends to replay the same cached
  // fix instead of delivering new ones as the user moves. A direct
  // watchPositionAsync subscription gets fresh fixes reliably. We run it only
  // while the app is active and the switch is on; when the app backgrounds,
  // the background task takes over.
  useEffect(() => {
    const shouldWatch = isOn && appActive && permissions.foregroundGranted;

    if (!shouldWatch) {
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10_000,
            distanceInterval: 10,
          },
          async (loc) => {
            const { latitude, longitude, speed, heading } = loc.coords;
            const capturedAt = new Date(
              loc.timestamp || Date.now(),
            ).toISOString();
            console.log(
              `[watch] fix t=${capturedAt} ${latitude.toFixed(5)},${longitude.toFixed(5)}`,
            );
            await handleFix({
              latitude,
              longitude,
              speed: speed ?? null,
              heading: heading ?? null,
              capturedAt,
            });
          },
        );
        if (cancelled) {
          sub.remove();
          return;
        }
        watchRef.current = sub;
      } catch (err) {
        console.warn("[watch] failed to start", err);
      }
    })();

    return () => {
      cancelled = true;
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [isOn, appActive, permissions.foregroundGranted]);

  const setOn = useCallback<TrackingContextValue["setOn"]>(
    async (on) => {
      if (!on) {
        try {
          await stopTracking();
          await refresh();
          return { ok: true };
        } catch (err) {
          await refresh();
          return { ok: false, reason: "error", error: err };
        }
      }

      // Turning ON: request foreground, then background (best-effort).
      // On iOS, requestForeground() is a no-op if already denied — check first
      // so we skip the unnecessary native round-trip and jump straight to the
      // "open settings" error path.
      const current = await getPermissionSnapshot();
      if (current.foreground === "denied") {
        return { ok: false, reason: "foreground-denied" };
      }
      const fgStatus = await requestForeground();
      if (fgStatus !== "granted") {
        await refresh();
        return { ok: false, reason: "foreground-denied" };
      }
      const bgStatus = await requestBackground();

      try {
        await startTracking({ allowForegroundOnly: bgStatus !== "granted" });
        await refresh();
        if (bgStatus !== "granted") {
          // Tracking is on, but only while app is open — surface to UI.
          return { ok: false, reason: "background-denied" };
        }
        return { ok: true };
      } catch (err) {
        await refresh();
        return { ok: false, reason: "error", error: err };
      }
    },
    [refresh],
  );

  const requestBackgroundPermission = useCallback(async () => {
    await requestBackground();
    await refresh();
    return getPermissionSnapshot();
  }, [refresh]);

  const value = useMemo<TrackingContextValue>(
    () => ({ isOn, permissions, refresh, setOn, requestBackgroundPermission }),
    [isOn, permissions, refresh, setOn, requestBackgroundPermission],
  );

  return (
    <TrackingContext.Provider value={value}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking(): TrackingContextValue {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error("useTracking must be used inside TrackingProvider");
  return ctx;
}
