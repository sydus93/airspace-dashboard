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

// True emergency (vs. merely notable/military) — drives the terracotta glow.
export function isEmergency(ac: Aircraft): boolean {
  if (ac.emergency && ac.emergency !== "none") return true;
  if (ac.squawk && EMERGENCY_SQUAWKS.has(ac.squawk)) return true;
  return false;
}

// "Airspace Mono" altitude bands — a value ramp: ground/low reads dim, high
// cruise reads full-strength ink. The instrument's own logic (no hue, just
// value), reserving the single sage accent for signal (notable) contacts.
// Bands: 0 GND · 1 <8k · 2 8–15k · 3 15–25k · 4 FL250+.
//
// These are CSS custom-property references, not literals, because every consumer
// applies them as a CSS value (inline style / SVG fill / Leaflet element style).
// That means the night↔day theme swap is a pure CSS token change — no React
// re-render, no theme argument threaded through the render tree. Token values
// live in globals.css under :root and :root[data-theme="day"].
export const ALT_RAMP = [
  "var(--alt-0)",
  "var(--alt-1)",
  "var(--alt-2)",
  "var(--alt-3)",
  "var(--alt-4)",
];
export const ALT_BAND_LABELS = ["GND", "< 8k", "8–15k", "15–25k", "FL250+"];
export const ACCENT = "var(--accent)"; // sage — notable/active/priority
export const INK_SEL = "var(--ink-bright)"; // selection ink

export function altBand(ac: Aircraft): number {
  if (ac.onGround) return 0;
  const a = ac.altBaroFt ?? 0;
  if (a < 8000) return 1;
  if (a < 15000) return 2;
  if (a < 25000) return 3;
  return 4;
}

export function altitudeColor(ac: Aircraft): string {
  return ALT_RAMP[altBand(ac)];
}

// Final marker / glyph color, applying the signal overrides on top of altitude.
export function markerColor(ac: Aircraft, selected = false): string {
  if (selected) return INK_SEL; // selected -> bright ink
  if (isNotable(ac)) return ACCENT; // military / emergency -> sage accent
  return altitudeColor(ac);
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
