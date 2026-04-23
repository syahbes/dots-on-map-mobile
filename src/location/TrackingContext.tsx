import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
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
  | { ok: false; reason: "foreground-denied" | "background-denied" | "error"; error?: unknown };

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
  const [isOn, setIsOn] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<PermissionSnapshot>(DEFAULT_PERMS);

  const refresh = useCallback(async () => {
    const [snap, active] = await Promise.all([getPermissionSnapshot(), isTrackingActive()]);
    setPermissions(snap);
    setIsOn(active);
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      // Re-sync when the user returns from Settings, etc.
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

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

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTracking(): TrackingContextValue {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error("useTracking must be used inside TrackingProvider");
  return ctx;
}
