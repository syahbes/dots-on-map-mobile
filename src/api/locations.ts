import { request } from "./client";

export type LocationPoint = {
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
};

export type RetroPoint = LocationPoint & {
  clientTsUtc: string; // ISO UTC
};

export type LocationRecord = {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  source: "live" | "retro";
  tsUtc: string;
  serverReceivedAt: string;
  clientTsUtc: string | null;
};

export function postLive(point: LocationPoint): Promise<LocationRecord> {
  return request<LocationRecord>("/locations/live", {
    method: "POST",
    body: {
      latitude: point.latitude,
      longitude: point.longitude,
      speed: point.speed ?? null,
      heading: point.heading ?? null,
    },
  });
}

export type RetroResponse = {
  accepted: LocationRecord[];
  rejected: { index: number; reason: string }[];
};

export function postRetroBatch(points: RetroPoint[]): Promise<RetroResponse> {
  return request<RetroResponse>("/locations/retro", {
    method: "POST",
    body: { points },
  });
}
