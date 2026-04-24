import { postLive } from "@/api/locations";
import { getEntityId } from "@/auth/entityStorage";
import { enqueue, initLocationDb } from "@/db/locationDb";
import { flushQueue, notifyQueueChanged } from "@/network/flush";

export type Fix = {
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  /** Epoch millis when the fix was captured on the device. */
  capturedAt: number;
};

/**
 * Minimum gap between two live POSTs to `/v1/location`.
 *
 * Both the foreground `watch` subscription and the background `task` route
 * fixes through `handleFix`, and on the iOS simulator's "City Run" (and
 * similar high-frequency sources) each of them can deliver ~1 fix/second,
 * producing ~2 POSTs/second. The backend doesn't need that resolution, so
 * we rate-limit here and simply drop intermediate fixes.
 */
const LIVE_POST_MIN_INTERVAL_MS = 15_000;

/** Timestamp (epoch millis) of the last attempted live POST. */
let lastLivePostAt = 0;

/**
 * Handle a single location fix.
 *
 *   signed-out          → drop (nothing to post, and enqueueing would leak
 *                        these points to the next user who signs in).
 *   throttled           → drop (see LIVE_POST_MIN_INTERVAL_MS above).
 *   post 2xx            → done.
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
  // No entityId = no signed-in user. Do not enqueue — those points have no
  // owner on the server and must not bleed into the next sign-in.
  const entityId = await getEntityId();
  if (!entityId) return;

  // Rate-limit: at most one live POST per LIVE_POST_MIN_INTERVAL_MS. We
  // record the attempt time (not just successes) so a burst of failures
  // can't bypass the throttle either.
  const now = Date.now();
  if (now - lastLivePostAt < LIVE_POST_MIN_INTERVAL_MS) {
    return;
  }
  lastLivePostAt = now;

  try {
    await initLocationDb();
  } catch (err) {
    console.warn("[pipeline] failed to init db", err);
    return;
  }

  try {
    await postLive(entityId, {
      lat: fix.latitude,
      lng: fix.longitude,
      speed: fix.speed ?? null,
      heading: fix.heading ?? null,
      accuracy: fix.accuracy ?? null,
      ts: fix.capturedAt,
    });
    // If there is anything queued, try to drain it now too.
    void flushQueue();
    return;
  } catch (err) {
    console.warn("[pipeline] live post failed, enqueueing", err);
  }

  try {
    await enqueue({
      latitude: fix.latitude,
      longitude: fix.longitude,
      speed: fix.speed ?? null,
      heading: fix.heading ?? null,
      accuracy: fix.accuracy ?? null,
      ts: fix.capturedAt,
    });
    notifyQueueChanged();
  } catch (err) {
    console.warn("[pipeline] failed to enqueue", err);
  }
}
