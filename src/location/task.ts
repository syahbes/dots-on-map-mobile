import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { handleFix } from "./pipeline";

export const LOCATION_TASK_NAME = "dots-background-location";

// Skip the Android JobScheduler-replay behaviour where the SAME cached fix is
// re-delivered every few seconds on the emulator. A fix with the same
// lat/lng/timestamp as the previous one is treated as a replay and dropped.
let lastFixKey: string | null = null;

/**
 * Background task. Defined at module top-level so it's registered before any
 * location update fires (including when the OS re-launches the app in
 * the background and runs only the JS engine + registered tasks).
 */
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn("[task] background location error", error);
    return;
  }
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  for (const loc of locations) {
    const { latitude, longitude, speed, heading, accuracy } = loc.coords;
    // `loc.timestamp` can be a float on iOS (sub-millisecond precision).
    // The backend validates `ts` as an integer, so truncate here.
    const capturedAt = Math.trunc(loc.timestamp || Date.now());
    const key = `${loc.timestamp}|${latitude}|${longitude}`;
    if (key === lastFixKey) {
      // Duplicate replay from JobScheduler — ignore.
      continue;
    }
    lastFixKey = key;
    console.log(
      `[task] fix t=${capturedAt} ${latitude.toFixed(5)},${longitude.toFixed(5)}`,
    );
    await handleFix({
      latitude,
      longitude,
      speed: speed ?? null,
      heading: heading ?? null,
      accuracy: accuracy ?? null,
      capturedAt,
    });
  }
});
