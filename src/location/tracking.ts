import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { LOCATION_TASK_NAME } from "./task";

export type PermissionStatus = Location.PermissionStatus;

export type PermissionSnapshot = {
  foreground: PermissionStatus;
  background: PermissionStatus;
  /** True if the user gave only a temporary "Allow Once" on iOS. */
  foregroundGranted: boolean;
  /** True if background ("Always" on iOS) is usable. */
  backgroundGranted: boolean;
};

export async function getPermissionSnapshot(): Promise<PermissionSnapshot> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  return {
    foreground: fg.status,
    background: bg.status,
    foregroundGranted: fg.status === "granted",
    backgroundGranted: bg.status === "granted",
  };
}

export async function requestForeground(): Promise<PermissionStatus> {
  const res = await Location.requestForegroundPermissionsAsync();
  return res.status;
}

export async function requestBackground(): Promise<PermissionStatus> {
  const res = await Location.requestBackgroundPermissionsAsync();
  return res.status;
}

export async function isTrackingActive(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  } catch {
    return false;
  }
}

export type StartOptions = {
  /** Only request background; foreground must already be granted. */
  allowForegroundOnly?: boolean;
};

export async function startTracking(opts: StartOptions = {}): Promise<void> {
  const already = await isTrackingActive();
  if (already) return;

  const perms = await getPermissionSnapshot();

  if (!perms.backgroundGranted) {
    throw new Error(
      "Background location permission not granted (Always / Allow all the time required)",
    );
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    // Android: throttle to ~10s / 10m so we don't flood the task.
    timeInterval: 10_000,
    // iOS ignores timeInterval; it uses distanceFilter. 10m gives roughly
    // one fix every 15–30s at walking/driving speeds. distanceInterval: 0
    // on iOS means "every fix", which iOS can then aggressively throttle
    // in the background — so we give it a real threshold instead.
    distanceInterval: 0,
    // NOTE: deferredUpdatesInterval/Distance use Apple's
    // `allowDeferredLocationUpdatesUntilTraveled:timeout:` API, which was
    // deprecated in iOS 13 and in practice prevents the JS task from
    // firing at all in the background. Do NOT re-enable.
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true, // iOS "blue bar"
    // DEBUG: temporarily hard-require the Android foreground service so we
    // fail loudly instead of silently degrading to foreground-only when
    // background permission is not actually granted at the OS level.
    foregroundService: {
      notificationTitle: "Dots on Map — tracking",
      notificationBody: "Recording your location in the background.",
      notificationColor: "#208AEF",
    },
    // Fitness gives iOS a better hint to keep the location stream alive in
    // the background than generic "Other".
    activityType: Location.ActivityType.Fitness,
  });
}

export async function stopTracking(): Promise<void> {
  const active = await isTrackingActive();
  if (!active) return;
  try {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch (err) {
    console.warn("[tracking] stop failed", err);
  }
}
