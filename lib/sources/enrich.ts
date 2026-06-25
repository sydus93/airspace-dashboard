import { fetchJson, HttpError } from "../http";
import { normalizeAircraftInfo, normalizeRoute } from "../normalize";
import type { AircraftInfo, FlightRoute } from "../types";

// adsbdb enrichment, memoized in-process. Aircraft info is stable (long TTL);
// routes change per-day (medium TTL). Route data is NOT persisted to disk —
// in-memory only — per adsbdb's no-republish terms (handoff §11).

const BASE = "https://api.adsbdb.com/v0";

interface Entry<T> {
  value: T | null; // null = looked up, not found (cache the miss)
  at: number;
}

const aircraftCache = new Map<string, Entry<AircraftInfo>>();
const routeCache = new Map<string, Entry<FlightRoute>>();

const AIRCRAFT_TTL = 24 * 60 * 60 * 1000; // 24h
const ROUTE_TTL = 60 * 60 * 1000; // 1h
const MAX_ENTRIES = 5000;

function getFresh<T>(cache: Map<string, Entry<T>>, key: string, ttl: number): Entry<T> | null {
  const e = cache.get(key);
  if (e && Date.now() - e.at < ttl) return e;
  return null;
}

function put<T>(cache: Map<string, Entry<T>>, key: string, value: T | null) {
  if (cache.size > MAX_ENTRIES) {
    // drop oldest-ish: clear the first 500 keys
    let n = 0;
    for (const k of cache.keys()) {
      cache.delete(k);
      if (++n >= 500) break;
    }
  }
  cache.set(key, { value, at: Date.now() });
}

export async function getAircraftInfo(hex: string): Promise<AircraftInfo | null> {
  const key = hex.toLowerCase();
  const hit = getFresh(aircraftCache, key, AIRCRAFT_TTL);
  if (hit) return hit.value;
  try {
    const raw = await fetchJson<Record<string, unknown>>(`${BASE}/aircraft/${encodeURIComponent(key)}`, {
      timeoutMs: 7000,
    });
    const info = normalizeAircraftInfo(raw);
    put(aircraftCache, key, info);
    return info;
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      put(aircraftCache, key, null); // remember the miss
      return null;
    }
    throw err;
  }
}

export async function getRoute(callsign: string): Promise<FlightRoute | null> {
  const key = callsign.trim().toUpperCase();
  if (!key) return null;
  const hit = getFresh(routeCache, key, ROUTE_TTL);
  if (hit) return hit.value;
  try {
    const raw = await fetchJson<Record<string, unknown>>(`${BASE}/callsign/${encodeURIComponent(key)}`, {
      timeoutMs: 7000,
    });
    const route = normalizeRoute(raw);
    put(routeCache, key, route);
    return route;
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      put(routeCache, key, null);
      return null;
    }
    throw err;
  }
}
