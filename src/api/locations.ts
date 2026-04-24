import { ENTITY_TYPE, TENANT_ID } from "@/config";
import { request } from "./client";

/**
 * Single location fix posted to `/v1/location` (live) or queued inside a
 * `/v1/locations` batch (retro).
 *
 * The backend expects epoch-millis timestamps and short field names
 * (`lat` / `lng`), which is why this shape differs from the richer internal
 * `Fix` type used by the pipeline.
 */
export type LocationPing = {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  /** Epoch millis. */
  ts: number;
};

/**
 * Post a single live fix to `/v1/location`. Equivalent to the old
 * `/locations/live` route on mock-express.
 */
export function postLive(entityId: string, ping: LocationPing): Promise<unknown> {
  return request("/v1/location", {
    method: "POST",
    body: {
      tenantId: TENANT_ID,
      entityType: ENTITY_TYPE,
      entityId,
      lat: ping.lat,
      lng: ping.lng,
      heading: ping.heading ?? null,
      speed: ping.speed ?? null,
      accuracy: ping.accuracy ?? null,
      ts: ping.ts,
    },
  });
}

/**
 * Post a batch of buffered fixes to `/v1/locations`. Equivalent to the old
 * `/locations/retro` route — used when the app recovers from offline or when
 * the background task accumulates fixes it couldn't post live.
 */
export function postRetroBatch(
  entityId: string,
  pings: LocationPing[],
): Promise<unknown> {
  return request("/v1/locations", {
    method: "POST",
    body: {
      tenantId: TENANT_ID,
      entityType: ENTITY_TYPE,
      entityId,
      pings,
    },
  });
}

export type OnlineStatus = "online" | "offline";

/**
 * Announce whether the user has the tracking switch on (`online`) or off
 * (`offline`). Called from `TrackingContext` whenever the switch flips.
 */
export function postStatus(
  entityId: string,
  status: OnlineStatus,
): Promise<unknown> {
  return request("/v1/status", {
    method: "POST",
    body: {
      tenantId: TENANT_ID,
      entityType: ENTITY_TYPE,
      entityId,
      status,
      ts: Date.now(),
    },
  });
}
