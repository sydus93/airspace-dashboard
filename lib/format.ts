import type { Aircraft } from "./types";

// Presentation helpers + the pure-derived "notable" selector (handoff §8).

export const EMERGENCY_SQUAWKS = new Set(["7500", "7600", "7700"]);

export function isNotable(ac: Aircraft): boolean {
  if (ac.isMilitary) return true;
  if (ac.emergency && ac.emergency !== "none") return true;
  if (ac.squawk && EMERGENCY_SQUAWKS.has(ac.squawk)) return true;
  return false;
}

export function notableReason(ac: Aircraft): string | null {
  if (ac.squawk && EMERGENCY_SQUAWKS.has(ac.squawk)) {
    if (ac.squawk === "7500") return "Hijack (7500)";
    if (ac.squawk === "7600") return "Radio failure (7600)";
    if (ac.squawk === "7700") return "Emergency (7700)";
  }
  if (ac.emergency && ac.emergency !== "none") return `Emergency: ${ac.emergency}`;
  if (ac.isMilitary) return "Military";
  return null;
}

export function aircraftLabel(ac: Aircraft): string {
  return ac.callsign || ac.registration || ac.hex.toUpperCase();
}

export function altitudeText(ac: Aircraft): string {
  if (ac.onGround) return "GND";
  if (ac.altBaroFt === null) return "—";
  return `${Math.round(ac.altBaroFt).toLocaleString()} ft`;
}

export function speedText(ac: Aircraft): string {
  return ac.groundSpeedKt === null ? "—" : `${Math.round(ac.groundSpeedKt)} kt`;
}

export function verticalRateText(ac: Aircraft): string {
  if (ac.verticalRateFpm === null || Math.abs(ac.verticalRateFpm) < 64) return "level";
  const arrow = ac.verticalRateFpm > 0 ? "▲" : "▼";
  return `${arrow} ${Math.abs(Math.round(ac.verticalRateFpm)).toLocaleString()} fpm`;
}

export function bearingText(deg: number | null): string {
  if (deg === null) return "—";
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function isAirlineCallsign(callsign: string | null): boolean {
  if (!callsign) return false;
  // ICAO airline callsigns: 3 letters + flight number (e.g. UAL123, SWA2480).
  return /^[A-Z]{3}\d+[A-Z]?$/.test(callsign);
}

// Altitude -> color, matching the MapLibre marker ramp, for UI chips.
export function altitudeColor(ac: Aircraft): string {
  if (ac.onGround) return "#9aa0a6";
  const a = ac.altBaroFt ?? 0;
  const stops: [number, string][] = [
    [0, "#f0502e"],
    [5000, "#f5a623"],
    [10000, "#7ed957"],
    [20000, "#26c6da"],
    [30000, "#4a90e2"],
    [40000, "#9b8cff"],
  ];
  let color = stops[0][1];
  for (const [alt, c] of stops) {
    if (a >= alt) color = c;
  }
  return color;
}

export function timeAgo(epochMs: number): string {
  const s = Math.max(0, Math.round((Date.now() - epochMs) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function isoTimeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return timeAgo(t);
}
