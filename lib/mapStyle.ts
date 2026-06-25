import type { StyleSpecification } from "maplibre-gl";

// Basemap strategy: default to an INLINE RASTER style. Vector basemaps (CARTO
// gl / OpenFreeMap) depend on a hosted style.json + glyph pbf + sprite + a web
// worker that decodes vector tiles — any one of which can silently fail on a
// given device/network and leave a black canvas (which is exactly what bit us).
// A raster style has one moving part: PNG tiles. It renders on anything with a
// WebGL context. Our own data layers (aircraft, ring, route) draw on top and do
// NOT depend on the basemap loading, so even a total tile failure still shows
// traffic on a dark background.
//
// Override with NEXT_PUBLIC_MAP_STYLE=<url-or-builtin> to use a vector style.

// glyphs host for our text layers (callsigns, airport codes). OFM serves Noto
// Sans with permissive CORS and is actively maintained.
export const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const LABEL_FONT = ["Noto Sans Bold"];
export const LABEL_FONT_REGULAR = ["Noto Sans Regular"];

type RasterVariant = "dark" | "voyager" | "positron";

const RASTER_BASE: Record<RasterVariant, string> = {
  dark: "dark_all",
  voyager: "rastertiles/voyager",
  positron: "light_all",
};

export function rasterStyle(variant: RasterVariant = "dark"): StyleSpecification {
  const base = RASTER_BASE[variant];
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      basemap: {
        type: "raster",
        // @2x (512px) tiles declared as logical 256 = crisp on retina phones.
        tiles: ["a", "b", "c", "d"].map(
          (s) => `https://${s}.basemaps.cartocdn.com/${base}/{z}/{x}/{y}@2x.png`
        ),
        tileSize: 256,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        minzoom: 0,
        maxzoom: 20,
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#05080c" } },
      { id: "basemap", type: "raster", source: "basemap", paint: { "raster-opacity": 1 } },
    ],
  };
}

// Resolve the style to hand MapLibre. A custom URL wins; otherwise inline raster.
export function resolveMapStyle(): string | StyleSpecification {
  const env = process.env.NEXT_PUBLIC_MAP_STYLE;
  if (env && env.startsWith("http")) return env;
  return rasterStyle("dark");
}
