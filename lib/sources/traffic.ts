import { fetchJson } from "../http";
import { normalizeTraffic } from "../normalize";
import type { Aircraft } from "../types";

// airplanes.live point query. radius in nautical miles (max 250).
export async function fetchTraffic(
  lat: number,
  lon: number,
  radiusNm: number
): Promise<{ aircraft: Aircraft[]; total: number; now: number }> {
  const r = Math.min(Math.max(radiusNm, 1), 250);
  const url = `https://api.airplanes.live/v2/point/${lat}/${lon}/${r}`;
  const raw = await fetchJson<{ ac?: unknown[]; total?: number; now?: number }>(url, {
    timeoutMs: 6000,
  });
  const aircraft = normalizeTraffic(raw as { ac?: never[] });
  return {
    aircraft,
    total: typeof raw.total === "number" ? raw.total : aircraft.length,
    now: typeof raw.now === "number" ? raw.now : Date.now(),
  };
}
