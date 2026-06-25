import type {
  AircraftInfo,
  ApiEnvelope,
  FlightRoute,
  Metar,
  TrafficFrame,
} from "@/lib/types";

// Thin typed fetchers for the same-origin proxy routes (handoff §7).

async function getJson<T>(url: string, signal?: AbortSignal): Promise<ApiEnvelope<T>> {
  const res = await fetch(url, { signal, cache: "no-store" });
  // Even 503s carry a usable (stale) envelope; parse regardless.
  const body = (await res.json()) as ApiEnvelope<T>;
  return body;
}

export function getTraffic(
  lat: number,
  lon: number,
  radiusNm: number,
  signal?: AbortSignal
): Promise<ApiEnvelope<TrafficFrame>> {
  const q = `lat=${lat}&lon=${lon}&radius=${radiusNm}`;
  return getJson<TrafficFrame>(`/api/traffic?${q}`, signal);
}

export function getWeather(
  ids: string[],
  signal?: AbortSignal
): Promise<ApiEnvelope<Metar[]>> {
  const q = ids.length ? `?ids=${encodeURIComponent(ids.join(","))}` : "";
  return getJson<Metar[]>(`/api/weather${q}`, signal);
}

export function enrichAircraft(hex: string): Promise<ApiEnvelope<AircraftInfo | null>> {
  return getJson<AircraftInfo | null>(`/api/enrich/aircraft/${encodeURIComponent(hex)}`);
}

export function enrichRoute(callsign: string): Promise<ApiEnvelope<FlightRoute | null>> {
  return getJson<FlightRoute | null>(`/api/enrich/route/${encodeURIComponent(callsign)}`);
}
