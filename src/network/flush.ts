import { postRetroBatch, type RetroPoint } from "@/api/locations";
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
 * Drain pending points to /locations/retro in chunks.
 * Returns the number of points successfully flushed.
 * Safe to call concurrently — only one flush runs at a time.
 */
export async function flushQueue(): Promise<number> {
  if (running) return 0;
  running = true;
  let flushed = 0;
  try {
    // Loop until the queue is empty or a chunk fails mid-flight.
    while (true) {
      const batch = await peekBatch(CHUNK_SIZE);
      if (batch.length === 0) break;

      const points: RetroPoint[] = batch.map((row) => ({
        latitude: row.latitude,
        longitude: row.longitude,
        speed: row.speed,
        heading: row.heading,
        clientTsUtc: row.client_ts_utc,
      }));

      let response;
      try {
        response = await postRetroBatch(points);
      } catch (err) {
        // Network / server error — stop and retry later.
        console.warn("[flush] retro batch failed, will retry later", err);
        break;
      }

      // Server echoes input order. Collect IDs for rows that were:
      //   - accepted (success — delete)
      //   - rejected with client-side reason (malformed — delete to avoid infinite retry)
      const rejectedIndices = new Set(response.rejected.map((r) => r.index));
      const idsToDelete: number[] = batch
        .map((row, idx) => ({ row, idx }))
        .filter(({ idx }) => !rejectedIndices.has(idx))
        .map(({ row }) => row.id)
        // Also drop rejected rows permanently.
        .concat(
          batch
            .filter((_, idx) => rejectedIndices.has(idx))
            .map((row) => row.id),
        );

      if (idsToDelete.length > 0) {
        await deleteByIds(idsToDelete);
        flushed += response.accepted.length;
        notifyQueueChanged();
      }

      // If the server accepted 0 points in this batch, treat as a hard failure and stop.
      if (response.accepted.length === 0) break;
    }
  } finally {
    running = false;
  }
  return flushed;
}
