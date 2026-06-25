// Normalized data model (handoff §6) + a few enrichment-free extras that
// airplanes.live already returns (desc/ownOp/year/dst/dir), surfaced so the
// target card is useful before adsbdb is even hit.

export type TrafficSource = "adsb" | "mlat" | "tisb" | "other";

export interface Aircraft {
  hex: string; // 24-bit ICAO, stable key
  callsign: string | null; // trimmed `flight`
  registration: string | null;
  typeCode: string | null; // ICAO type, e.g. "C172"
  lat: number;
  lon: number;
  altBaroFt: number | null; // null when on ground
  onGround: boolean; // alt_baro === "ground"
  altGeomFt: number | null;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  verticalRateFpm: number | null;
  squawk: string | null;
  emergency: string | null; // "none" | "general" | "lifeguard" | "minfuel" | "nordo" | "unlawful" | "downed"
  isMilitary: boolean; // dbFlags bit 0
  category: string | null;
  positionAgeSec: number | null; // seen_pos
  source: TrafficSource;
  // free extras from airplanes.live
  description: string | null; // `desc`, e.g. "CESSNA 172 Skyhawk"
  ownerOp: string | null; // `ownOp`
  year: string | null;
  distanceNm: number | null; // `dst` from query point
  bearingDeg: number | null; // `dir` from query point
}

export interface TrafficFrame {
  aircraft: Aircraft[];
  fetchedAt: number; // epoch ms
  stale: boolean;
  total?: number; // upstream total before any cap
}

export type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR" | null;

export interface Metar {
  icaoId: string;
  raw: string;
  observedAt: string; // ISO
  name: string | null;
  lat: number | null;
  lon: number | null;
  tempC: number | null;
  dewpointC: number | null;
  windDirDeg: number | null; // null when variable/calm
  windVariable: boolean;
  windSpeedKt: number | null;
  windGustKt: number | null;
  visibilityMi: number | null;
  visibilityText: string | null; // preserves "10+"
  altimeterInHg: number | null;
  wxString: string | null;
  flightCategory: FlightCategory;
}

export interface Taf {
  icaoId: string;
  raw: string;
  issuedAt: string;
  validFrom: string;
  validTo: string;
}

export interface Pirep {
  raw: string;
  receivedAt: string;
  lat: number | null;
  lon: number | null;
  altitudeFt: number | null;
  turbulence: string | null;
  icing: string | null;
}

export interface AircraftInfo {
  typeName: string | null; // "G650 ER"
  icaoType: string | null;
  manufacturer: string | null;
  registration: string | null;
  owner: string | null;
  ownerCountry: string | null;
  photoUrl: string | null;
  photoThumbUrl: string | null;
}

export interface Airport {
  icao: string;
  iata: string | null;
  name: string;
  municipality: string | null;
  lat: number;
  lon: number;
}

export interface FlightRoute {
  callsign: string;
  airlineName: string | null;
  origin: Airport | null;
  destination: Airport | null;
}

export type AudioBackend = "local-icecast" | "remote-stream";

export interface AudioChannel {
  id: string;
  label: string; // "KAPA Tower"
  freqMhz?: number;
  url: string; // Icecast mount or stream URL
  backend: AudioBackend;
  // routing override: force same-origin proxy (needed for http Icecast on an
  // https PWA, or for CORS-restricted sources). Defaults derived from backend.
  proxy?: boolean;
  note?: string;
}

// Generic envelope returned by every /api proxy route.
export interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  stale: boolean;
  fetchedAt: number;
  error?: string;
}
