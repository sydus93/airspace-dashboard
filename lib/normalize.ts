import type {
  Aircraft,
  AircraftInfo,
  Airport,
  FlightCategory,
  FlightRoute,
  Metar,
  Taf,
  TrafficSource,
} from "./types";

// Raw upstream JSON -> normalized models (handoff §6). Built against the live
// schemas captured June 2026 (see docs/airspace-dashboard-handoff.md §4).

// ---- traffic (airplanes.live) ----

interface RawAircraft {
  hex?: string;
  type?: string; // "adsb_icao" | "mlat" | "tisb_*" | ...
  flight?: string;
  r?: string;
  t?: string;
  desc?: string;
  ownOp?: string;
  year?: string;
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number;
  track?: number;
  true_heading?: number;
  mag_heading?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  emergency?: string;
  category?: string;
  lat?: number;
  lon?: number;
  seen_pos?: number;
  dbFlags?: number;
  dst?: number;
  dir?: number;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function mapSource(type: string | undefined): TrafficSource {
  if (!type) return "other";
  if (type.includes("mlat")) return "mlat";
  if (type.includes("tisb")) return "tisb";
  if (type.includes("adsb") || type.includes("adsr") || type.includes("mode_s"))
    return "adsb";
  return "other";
}

export function normalizeAircraft(raw: RawAircraft): Aircraft | null {
  const hex = trimOrNull(raw.hex);
  const lat = num(raw.lat);
  const lon = num(raw.lon);
  if (!hex || lat === null || lon === null) return null; // unusable without a key + position

  const onGround = raw.alt_baro === "ground";
  const altBaroFt = onGround ? null : num(raw.alt_baro);

  return {
    hex: hex.toLowerCase(),
    callsign: trimOrNull(raw.flight),
    registration: trimOrNull(raw.r),
    typeCode: trimOrNull(raw.t),
    lat,
    lon,
    altBaroFt,
    onGround,
    altGeomFt: num(raw.alt_geom),
    groundSpeedKt: num(raw.gs),
    trackDeg: num(raw.track) ?? num(raw.true_heading) ?? num(raw.mag_heading),
    verticalRateFpm: num(raw.baro_rate) ?? num(raw.geom_rate),
    squawk: trimOrNull(raw.squawk),
    emergency: trimOrNull(raw.emergency),
    isMilitary: ((raw.dbFlags ?? 0) & 1) === 1,
    category: trimOrNull(raw.category),
    positionAgeSec: num(raw.seen_pos),
    source: mapSource(raw.type),
    description: trimOrNull(raw.desc),
    ownerOp: trimOrNull(raw.ownOp),
    year: trimOrNull(raw.year),
    distanceNm: num(raw.dst),
    bearingDeg: num(raw.dir),
  };
}

export function normalizeTraffic(raw: { ac?: RawAircraft[] }): Aircraft[] {
  const list = Array.isArray(raw.ac) ? raw.ac : [];
  const out: Aircraft[] = [];
  for (const r of list) {
    const ac = normalizeAircraft(r);
    if (ac) out.push(ac);
  }
  return out;
}

// ---- weather (aviationweather.gov) ----

interface RawMetar {
  icaoId?: string;
  rawOb?: string;
  reportTime?: string;
  obsTime?: number;
  name?: string;
  lat?: number;
  lon?: number;
  temp?: number;
  dewp?: number;
  wdir?: number | string; // can be "VRB"
  wspd?: number;
  wgst?: number;
  visib?: number | string; // can be "10+"
  altim?: number; // hPa / millibars
  wxString?: string;
  fltCat?: string;
}

const HPA_PER_INHG = 33.8639;

function parseVisibility(v: number | string | undefined): {
  mi: number | null;
  text: string | null;
} {
  if (v === undefined || v === null) return { mi: null, text: null };
  if (typeof v === "number") return { mi: v, text: String(v) };
  const text = v.trim();
  const m = text.match(/[\d.]+/);
  return { mi: m ? Number(m[0]) : null, text };
}

function asFlightCategory(v: string | undefined): FlightCategory {
  if (v === "VFR" || v === "MVFR" || v === "IFR" || v === "LIFR") return v;
  return null;
}

export function normalizeMetar(raw: RawMetar): Metar | null {
  const icaoId = trimOrNull(raw.icaoId);
  if (!icaoId) return null;
  const vis = parseVisibility(raw.visib);
  const windVariable = typeof raw.wdir === "string" && /vrb/i.test(raw.wdir);
  const observedAt = raw.reportTime
    ? raw.reportTime
    : raw.obsTime
    ? new Date(raw.obsTime * 1000).toISOString()
    : new Date().toISOString();

  return {
    icaoId,
    raw: raw.rawOb ?? "",
    observedAt,
    name: trimOrNull(raw.name),
    lat: num(raw.lat),
    lon: num(raw.lon),
    tempC: num(raw.temp),
    dewpointC: num(raw.dewp),
    windDirDeg: typeof raw.wdir === "number" ? raw.wdir : null,
    windVariable,
    windSpeedKt: num(raw.wspd),
    windGustKt: num(raw.wgst),
    visibilityMi: vis.mi,
    visibilityText: vis.text,
    altimeterInHg: num(raw.altim) !== null ? round2((raw.altim as number) / HPA_PER_INHG) : null,
    wxString: trimOrNull(raw.wxString),
    flightCategory: asFlightCategory(raw.fltCat),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normalizeMetars(raw: RawMetar[]): Metar[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeMetar).filter((m): m is Metar => m !== null);
}

interface RawTaf {
  icaoId?: string;
  rawTAF?: string;
  issueTime?: string;
  validTimeFrom?: number;
  validTimeTo?: number;
}

export function normalizeTafs(raw: RawTaf[]): Taf[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => trimOrNull(t.icaoId))
    .map((t) => ({
      icaoId: t.icaoId as string,
      raw: t.rawTAF ?? "",
      issuedAt: t.issueTime ?? "",
      validFrom: t.validTimeFrom ? new Date(t.validTimeFrom * 1000).toISOString() : "",
      validTo: t.validTimeTo ? new Date(t.validTimeTo * 1000).toISOString() : "",
    }));
}

// ---- enrichment (adsbdb) ----

interface RawAircraftInfo {
  response?: {
    aircraft?: {
      type?: string;
      icao_type?: string;
      manufacturer?: string;
      registration?: string;
      registered_owner?: string;
      registered_owner_country_name?: string;
      url_photo?: string | null;
      url_photo_thumbnail?: string | null;
    };
  };
}

export function normalizeAircraftInfo(raw: RawAircraftInfo): AircraftInfo | null {
  const a = raw.response?.aircraft;
  if (!a) return null;
  return {
    typeName: trimOrNull(a.type),
    icaoType: trimOrNull(a.icao_type),
    manufacturer: trimOrNull(a.manufacturer),
    registration: trimOrNull(a.registration),
    owner: trimOrNull(a.registered_owner),
    ownerCountry: trimOrNull(a.registered_owner_country_name),
    photoUrl: trimOrNull(a.url_photo),
    photoThumbUrl: trimOrNull(a.url_photo_thumbnail),
  };
}

interface RawAirport {
  icao_code?: string;
  iata_code?: string;
  name?: string;
  municipality?: string;
  latitude?: number;
  longitude?: number;
}

interface RawRoute {
  response?: {
    flightroute?: {
      callsign?: string;
      airline?: { name?: string };
      origin?: RawAirport;
      destination?: RawAirport;
    };
  };
}

function normalizeAirport(a: RawAirport | undefined): Airport | null {
  if (!a) return null;
  const icao = trimOrNull(a.icao_code);
  const lat = num(a.latitude);
  const lon = num(a.longitude);
  if (!icao || lat === null || lon === null) return null;
  return {
    icao,
    iata: trimOrNull(a.iata_code),
    name: trimOrNull(a.name) ?? icao,
    municipality: trimOrNull(a.municipality),
    lat,
    lon,
  };
}

export function normalizeRoute(raw: RawRoute): FlightRoute | null {
  const r = raw.response?.flightroute;
  if (!r) return null;
  return {
    callsign: trimOrNull(r.callsign) ?? "",
    airlineName: trimOrNull(r.airline?.name),
    origin: normalizeAirport(r.origin),
    destination: normalizeAirport(r.destination),
  };
}
