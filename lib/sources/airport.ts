// Airport ground layout from OpenStreetMap aeroway data via Overpass.
// Runways, taxiways and aprons within a (small, airport-scale) bbox, normalized
// to plain [lat,lon] geometry. Tokenless; Overpass mirrors want a real UA, so we
// go through fetchWithTimeout (which sets one) and fall back across mirrors.

import { fetchWithTimeout } from "@/lib/http";
import type { AirportFeature, AirportLayout } from "@/lib/types";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

interface OverpassEl {
  type: string;
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

export async function fetchAirportLayout(
  bbox: [number, number, number, number]
): Promise<AirportLayout> {
  const [s, w, n, e] = bbox;
  const query =
    `[out:json][timeout:25];` +
    `(way["aeroway"~"^(runway|taxiway|apron)$"](${s},${w},${n},${e}););` +
    `out geom;`;

  let lastErr: unknown;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(url, {
        timeoutMs: 20_000,
        headers: { Accept: "application/json" },
        init: {
          method: "POST",
          body: "data=" + encodeURIComponent(query),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      });
      if (!res.ok) throw new Error(`overpass HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: OverpassEl[] };
      return { features: normalize(json.elements ?? []), bbox };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("overpass unavailable");
}

function normalize(els: OverpassEl[]): AirportFeature[] {
  const out: AirportFeature[] = [];
  for (const el of els) {
    const kind = el.tags?.aeroway;
    if (kind !== "runway" && kind !== "taxiway" && kind !== "apron") continue;
    const geom = el.geometry;
    if (!geom || geom.length < 2) continue;
    out.push({
      kind,
      coords: geom.map((g) => [g.lat, g.lon] as [number, number]),
      ref: el.tags?.ref ?? null,
      surface: el.tags?.surface ?? null,
    });
  }
  return out;
}
