import { postRetroBatch, type LocationPing } from "@/api/locations";
import { getEntityId } from "@/auth/entityStorage";
import { deleteByIds, peekBatch } from "@/db/locationDb";

const CHUNK_SIZE = 100;

let running = false;

/** Events emitted whenever the queue size changes so contexts can refresh. */
type QueueChangeListener = () => void;
const listeners = new Set<QueueChangeListener>();

export function onQueueChange(listener: QueueChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyQueueChanged(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/**
 * Drain pending points to `/v1/locations` in chunks. Returns the number of
 * points successfully flushed. Safe to call concurrently — only one flush
 * runs at a time.
 *
 * Each chunk is posted as one `pings` batch. The backend returns a single
 * accept/reject for the whole batch, so on success we delete every row in the
 * chunk, and on failure we leave the chunk in place for the next retry.
 */
export async function flushQueue(): Promise<number> {
  if (running) return 0;
  running = true;
  let flushed = 0;
  try {
    const entityId = await getEntityId();
    if (!entityId) {
      // No signed-in user — nothing we can legitimately attribute to anyone.
      return 0;
    }

    // Loop until the queue is empty or a chunk fails mid-flight.
    while (true) {
      const batch = await peekBatch(CHUNK_SIZE);
      if (batch.length === 0) break;

      const pings: LocationPing[] = batch.map((row) => ({
        lat: row.latitude,
        lng: row.longitude,
        speed: row.speed,
        heading: row.heading,
        accuracy: row.accuracy,
        ts: row.ts,
      }));

      try {
        await postRetroBatch(entityId, pings);
      } catch (err) {
        // Network / server error — stop and retry later.
        console.warn("[flush] retro batch failed, will retry later", err);
        break;
      }

      await deleteByIds(batch.map((row) => row.id));
      flushed += batch.length;
      notifyQueueChanged();
    }
  } finally {
    running = false;
  }
  return flushed;
}
