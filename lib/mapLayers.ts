// Leaflet tile sources. Basemap + weather overlays. All tokenless and served as
// plain raster <img> tiles (no WebGL / worker / CORS needed) — the whole reason
// we moved off the GL renderer: img tiles render on any browser incl. iOS Safari.

export interface BasemapDef {
  id: string;
  label: string;
  url: string;
  subdomains?: string;
  attribution: string;
  maxZoom: number;
  maxNativeZoom?: number; // tiles only exist to here; Leaflet upscales beyond
  detectRetina?: boolean;
  minNativeZoom?: number; // no tiles below this zoom (FAA sectional starts at z8)
  // true when the tiles are light/bright — markers + chrome need stronger contrast
  light?: boolean;
}

// Switchable basemaps. Dark for night/ambient, light for daytime, and the real
// FAA VFR sectional (airports, airspace, terrain) for chart-accurate day use.
export const BASEMAPS: BasemapDef[] = [
  {
    id: "dark",
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    detectRetina: true,
  },
  {
    id: "light",
    label: "Light",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    detectRetina: true,
    light: true,
  },
  {
    id: "sectional",
    label: "Sectional",
    // FAA official VFR sectional raster, via our same-origin proxy (the upstream
    // ArcGIS tiles are octet-stream + nosniff, so the browser won't paint them
    // directly). Path is {z}/{y}/{x}; native tiles ~ to z11, upscale beyond.
    url: "/api/sectional/{z}/{y}/{x}",
    attribution: "FAA Aeronautical Information Services",
    maxZoom: 19,
    maxNativeZoom: 11,
    minNativeZoom: 8, // FAA service has no tiles below z8
    light: true,
  },
];

export const DEFAULT_BASEMAP = "dark";

export function getBasemap(id: string): BasemapDef {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];
}

// Back-compat default export used by the initial map render.
export const BASEMAP = BASEMAPS[0];

export interface OverlayDef {
  id: string;
  label: string;
  url: string;
  subdomains?: string;
  opacity: number;
  attribution: string;
  // refresh cadence in ms for time-sensitive layers (0 = never)
  refreshMs: number;
}

// Free weather overlays from Iowa Environmental Mesonet (NWS/NOAA data).
export const OVERLAYS: OverlayDef[] = [
  {
    id: "radar",
    label: "NEXRAD radar",
    url: "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png",
    opacity: 0.55,
    attribution: "NWS NEXRAD via IEM",
    refreshMs: 4 * 60_000,
  },
  {
    id: "satellite",
    label: "IR satellite",
    url: "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-east-conus-13/{z}/{x}/{y}.png",
    opacity: 0.5,
    attribution: "GOES-East IR via IEM",
    refreshMs: 5 * 60_000,
  },
];
