import NetInfo from "@react-native-community/netinfo";
import { ApiError } from "@/api/client";
import { postLive } from "@/api/locations";
import { getToken } from "@/auth/tokenStorage";
import { enqueue, initLocationDb } from "@/db/locationDb";
import { flushQueue, notifyQueueChanged } from "@/network/flush";

export type Fix = {
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  /** Time of fix, ISO. Used only when we enqueue (retro path). */
  capturedAt: string;
};

/**
 * Handle a single location fix.
 *
 *   signed-out  → drop (nothing to post, and enqueueing would leak these
 *                points to the next user who signs in).
 *   online, 2xx → done.
 *   online, 401 → drop (auth is dead; same leak concern as above).
 *   offline / network error / 5xx → enqueue to SQLite for later retro flush.
 *
 * Used by both the foreground watch and the background task so they behave
 * identically.
 */
export async function handleFix(fix: Fix): Promise<void> {
  // No token = no user. Do not enqueue — those points have no owner on the
  // server and must not bleed into the next sign-in.
  const token = await getToken();
  if (!token) return;

  try {
    await initLocationDb();
  } catch (err) {
    console.warn("[pipeline] failed to init db", err);
    return;
  }

  let online = true;
  try {
    const state = await NetInfo.fetch();
    online = !!state.isConnected && state.isInternetReachable !== false;
  } catch {
    online = false;
  }

  if (online) {
    try {
      await postLive({
        latitude: fix.latitude,
        longitude: fix.longitude,
        speed: fix.speed ?? null,
        heading: fix.heading ?? null,
      });
      // If there is anything queued, try to drain it now too.
      void flushQueue();
      return;
    } catch (err) {
      // Auth error — token is bad/expired. Do NOT enqueue: the API client has
      // already cleared the token and broadcast a sign-out, and these points
      // would otherwise end up attached to the next user.
      if (err instanceof ApiError && err.status === 401) {
        console.warn("[pipeline] 401 from /locations/live, dropping point");
        return;
      }
      console.warn("[pipeline] live post failed, enqueueing", err);
    }
  }

  try {
    await enqueue({
      latitude: fix.latitude,
      longitude: fix.longitude,
      speed: fix.speed ?? null,
      heading: fix.heading ?? null,
      clientTsUtc: fix.capturedAt,
    });
    notifyQueueChanged();
  } catch (err) {
    console.warn("[pipeline] failed to enqueue", err);
  }
}
