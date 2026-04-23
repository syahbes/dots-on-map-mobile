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

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10_000, // 10s (Android)
    distanceInterval: 25, // 25m
    deferredUpdatesInterval: 30_000, // iOS batch hint
    deferredUpdatesDistance: 25,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true, // iOS "blue bar"
    foregroundService: opts.allowForegroundOnly
      ? undefined
      : {
          notificationTitle: "Dots on Map — tracking",
          notificationBody: "Recording your location in the background.",
          notificationColor: "#208AEF",
        },
    activityType: Location.ActivityType.Other,
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
