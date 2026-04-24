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
 *   signed-out          → drop (nothing to post, and enqueueing would leak
 *                        these points to the next user who signs in).
 *   post 2xx            → done.
 *   post 401            → drop (auth is dead; same leak concern as above).
 *   post fails (offline
 *   / server / timeout) → enqueue to SQLite for later retro flush.
 *
 * NOTE: we intentionally do NOT consult NetInfo here. In a backgrounded /
 * cold-started JS engine on iOS, `NetInfo.fetch()` can hang or return stale
 * `isInternetReachable` values long enough that iOS kills the task before we
 * ever POST. Always trying the POST first is both cheaper and more correct:
 * if we really are offline, `fetch` rejects quickly and we fall through to
 * the enqueue branch.
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
