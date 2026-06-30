import type { Aircraft } from "./types";

// Sky geometry — the trig that turns "a plane at lat/lon/alt" into "where to look
// in the sky from where I'm standing": an azimuth (compass bearing) and an
// elevation angle above the horizon. This is the math the Sky HUD is built on and
// the same math Tier 1/2 (orientation + camera AR) will reuse.
//
// We compute everything from the OBSERVER (the home point) and the aircraft's own
// lat/lon — deliberately NOT the feed's `dst`/`dir`, which are relative to whatever
// point was last queried (e.g. after "scan this area"). The sky is always measured
// from where you actually are.

const R_NM = 3440.065; // mean earth radius in nautical miles
const FT_PER_NM = 6076.12;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export interface Observer {
  lat: number;
  lon: number;
  elevationFt?: number; // ground elevation of the observer; defaults to 0 (sea level)
}

export interface SkyContact {
  ac: Aircraft;
  azimuthDeg: number; // 0 = N, 90 = E, clockwise — compass bearing observer→plane
  elevationDeg: number; // 0 = horizon, 90 = straight up (zenith)
  groundRangeNm: number; // great-circle distance along the ground
  slantRangeNm: number; // true line-of-sight distance (what your eye spans)
}

// Initial great-circle bearing from observer to a point, degrees clockwise from N.
export function azimuthDeg(obs: Observer, lat: number, lon: number): number {
  const phi1 = toRad(obs.lat);
  const phi2 = toRad(lat);
  const dLambda = toRad(lon - obs.lon);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Haversine great-circle distance, nautical miles.
export function groundRangeNm(obs: Observer, lat: number, lon: number): number {
  const phi1 = toRad(obs.lat);
  const phi2 = toRad(lat);
  const dPhi = toRad(lat - obs.lat);
  const dLambda = toRad(lon - obs.lon);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Resolve a single aircraft into a sky contact, or null if it can't be placed in
// the sky (on the ground, no altitude, or no position).
export function toSkyContact(obs: Observer, ac: Aircraft): SkyContact | null {
  if (ac.onGround) return null;
  if (!Number.isFinite(ac.lat) || !Number.isFinite(ac.lon)) return null;
  const altFt = ac.altGeomFt ?? ac.altBaroFt;
  if (altFt === null || !Number.isFinite(altFt)) return null;

  const ground = groundRangeNm(obs, ac.lat, ac.lon);
  const heightFt = altFt - (obs.elevationFt ?? 0);
  const groundFt = ground * FT_PER_NM;
  const elevationDeg = toDeg(Math.atan2(heightFt, groundFt));
  const slantRangeNm = Math.hypot(groundFt, heightFt) / FT_PER_NM;

  return {
    ac,
    azimuthDeg: azimuthDeg(obs, ac.lat, ac.lon),
    elevationDeg,
    groundRangeNm: ground,
    slantRangeNm,
  };
}

// Build every visible sky contact (above the horizon), nearest first by slant
// range. `minElevationDeg` trims contacts hugging the horizon (default -1° keeps
// everything genuinely at/above eye level; bump it up to declutter distant cruisers).
export function buildSkyContacts(
  obs: Observer,
  aircraft: Aircraft[],
  minElevationDeg = -1
): SkyContact[] {
  const out: SkyContact[] = [];
  for (const ac of aircraft) {
    const c = toSkyContact(obs, ac);
    if (c && c.elevationDeg >= minElevationDeg) out.push(c);
  }
  return out.sort((a, b) => a.slantRangeNm - b.slantRangeNm);
}

// Signed smallest difference a − b, degrees, in (−180, 180]. Handles the 0/360
// wrap — used to measure how far a contact's bearing is from where you're aimed.
export function angleDiff(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

// Dome projection: looking up, zenith at the center, horizon at the rim. Returns a
// point on a unit dome centered at (0,0) with N up, E right (a top-down compass
// reading — Tier 1 will rotate the ring to match where the phone points). Multiply
// by the dome radius to place it. Elevation is clamped to [0,90].
export function projectToDome(
  azimuthDeg: number,
  elevationDeg: number,
  radius: number
): { x: number; y: number } {
  const el = Math.max(0, Math.min(90, elevationDeg));
  const r = (1 - el / 90) * radius;
  const theta = toRad(azimuthDeg);
  return { x: r * Math.sin(theta), y: -r * Math.cos(theta) };
}
