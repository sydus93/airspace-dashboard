// Leaflet tile sources. Basemap + weather overlays. All tokenless and served as
// plain raster <img> tiles (no WebGL / worker / CORS needed) — the whole reason
// we moved off the GL renderer: img tiles render on any browser incl. iOS Safari.

export const BASEMAP = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  subdomains: "abcd",
  attribution:
    '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
  maxZoom: 19,
};

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
