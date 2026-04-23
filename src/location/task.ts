import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import NetInfo from "@react-native-community/netinfo";
import { postLive } from "@/api/locations";
import { enqueue, initLocationDb } from "@/db/locationDb";
import { flushQueue, notifyQueueChanged } from "@/network/flush";

export const LOCATION_TASK_NAME = "dots-background-location";

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

  try {
    await initLocationDb();
  } catch (err) {
    console.warn("[task] failed to init db", err);
    return;
  }

  // Determine whether we believe the device is online. NetInfo can be polled
  // from a background task.
  let online = true;
  try {
    const state = await NetInfo.fetch();
    online = !!state.isConnected && state.isInternetReachable !== false;
  } catch {
    online = false;
  }

  for (const loc of locations) {
    const { latitude, longitude, speed, heading } = loc.coords;
    const capturedAt = new Date(loc.timestamp || Date.now()).toISOString();

    if (online) {
      try {
        await postLive({
          latitude,
          longitude,
          speed: speed ?? null,
          heading: heading ?? null,
        });
        continue;
      } catch (err) {
        // Fall through to enqueue.
        console.warn("[task] live post failed, enqueueing", err);
      }
    }

    try {
      await enqueue({
        latitude,
        longitude,
        speed: speed ?? null,
        heading: heading ?? null,
        clientTsUtc: capturedAt,
      });
      notifyQueueChanged();
    } catch (err) {
      console.warn("[task] failed to enqueue", err);
    }
  }

  // Opportunistic flush: if we appear online, try to drain.
  if (online) {
    try {
      await flushQueue();
    } catch (err) {
      console.warn("[task] flush failed", err);
    }
  }
});
