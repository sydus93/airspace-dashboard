"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Aircraft,
  AircraftInfo,
  FlightRoute,
  Metar,
  TrafficFrame,
} from "@/lib/types";
import { config } from "@/lib/config";

interface Enrichment {
  info: AircraftInfo | null;
  infoLoading: boolean;
  route: FlightRoute | null;
  routeLoading: boolean;
}

export interface HomePoint {
  lat: number;
  lon: number;
  radiusNm: number;
  label: string;
}

export interface AirspaceState {
  // viewport / query center (persisted)
  home: HomePoint;
  // live map center, written by MapView on move; used by "scan this area"
  mapCenter: { lat: number; lon: number } | null;

  // traffic
  frame: TrafficFrame | null;
  trafficStale: boolean;
  trafficError: string | null;
  lastTrafficAt: number;

  // weather
  metars: Metar[];
  weatherStale: boolean;
  weatherError: string | null;
  lastWeatherAt: number;

  // selection + enrichment (in-memory cache, keyed by hex)
  selectedHex: string | null;
  enrichments: Record<string, Enrichment>;

  // ui
  followSelected: boolean;
  overlays: Record<string, boolean>; // weather overlay id -> enabled
  basemap: string; // active basemap id (see lib/mapLayers BASEMAPS)
  chartMode: "radar" | "sectional"; // central view: SVG scope vs. Leaflet map
  theme: "night" | "day"; // Airspace Mono ink-on-black vs. Foolscap paper
  skyHeadingOffset: number; // manual Sky HUD compass fine-tune, degrees (persisted)

  // actions
  toggleOverlay: (id: string) => void;
  setBasemap: (id: string) => void;
  setChartMode: (mode: "radar" | "sectional") => void;
  setTheme: (t: "night" | "day") => void;
  toggleTheme: () => void;
  setHome: (lat: number, lon: number, opts?: { radiusNm?: number; label?: string }) => void;
  setRadius: (radiusNm: number) => void;
  setMapCenter: (lat: number, lon: number) => void;
  setFrame: (frame: TrafficFrame, stale: boolean, error: string | null) => void;
  setWeather: (metars: Metar[], stale: boolean, error: string | null) => void;
  select: (hex: string | null) => void;
  setInfo: (hex: string, info: AircraftInfo | null) => void;
  setInfoLoading: (hex: string, loading: boolean) => void;
  setRoute: (hex: string, route: FlightRoute | null) => void;
  setRouteLoading: (hex: string, loading: boolean) => void;
  setFollow: (v: boolean) => void;
  nudgeSkyHeadingOffset: (delta: number) => void;
  resetSkyHeadingOffset: () => void;
}

const clampRadius = (r: number) => Math.min(250, Math.max(5, Math.round(r)));

export const useAirspace = create<AirspaceState>()(
  persist(
    (set) => ({
      home: { ...config.home },
      mapCenter: null,

      frame: null,
      trafficStale: false,
      trafficError: null,
      lastTrafficAt: 0,

      metars: [],
      weatherStale: false,
      weatherError: null,
      lastWeatherAt: 0,

      selectedHex: null,
      enrichments: {},

      followSelected: false,
      overlays: { radar: false, satellite: false, airports: false, airfields: true },
      basemap: "dark",
      chartMode: "radar",
      theme: "night",
      skyHeadingOffset: 0,

      toggleOverlay: (id) =>
        set((s) => ({ overlays: { ...s.overlays, [id]: !s.overlays[id] } })),

      setBasemap: (id) => set({ basemap: id }),

      setChartMode: (mode) => set({ chartMode: mode }),

      // Day mode also swaps to a light basemap (and back), since a paper theme
      // over dark tiles reads as a bug rather than a choice.
      setTheme: (t) =>
        set((s) => ({
          theme: t,
          basemap:
            t === "day"
              ? s.basemap === "dark"
                ? "light"
                : s.basemap
              : s.basemap === "light"
                ? "dark"
                : s.basemap,
        })),
      toggleTheme: () => {
        const cur = useAirspace.getState();
        cur.setTheme(cur.theme === "night" ? "day" : "night");
      },

      setHome: (lat, lon, opts) =>
        set((s) => ({
          home: {
            lat,
            lon,
            radiusNm: clampRadius(opts?.radiusNm ?? s.home.radiusNm),
            label: opts?.label ?? `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
          },
          // selection from the old area no longer makes sense
          selectedHex: null,
          followSelected: false,
        })),

      setRadius: (radiusNm) =>
        set((s) => ({ home: { ...s.home, radiusNm: clampRadius(radiusNm) } })),

      setMapCenter: (lat, lon) => set({ mapCenter: { lat, lon } }),

      setFrame: (frame, stale, error) =>
        set({ frame, trafficStale: stale, trafficError: error, lastTrafficAt: Date.now() }),

      setWeather: (metars, stale, error) =>
        set((s) => ({
          metars: metars.length ? metars : s.metars, // keep last good if empty
          weatherStale: stale,
          weatherError: error,
          lastWeatherAt: Date.now(),
        })),

      select: (hex) => set({ selectedHex: hex }),

      setInfo: (hex, info) =>
        set((s) => ({
          enrichments: {
            ...s.enrichments,
            [hex]: { ...emptyEnrichment(), ...s.enrichments[hex], info, infoLoading: false },
          },
        })),
      setInfoLoading: (hex, loading) =>
        set((s) => ({
          enrichments: {
            ...s.enrichments,
            [hex]: { ...emptyEnrichment(), ...s.enrichments[hex], infoLoading: loading },
          },
        })),
      setRoute: (hex, route) =>
        set((s) => ({
          enrichments: {
            ...s.enrichments,
            [hex]: { ...emptyEnrichment(), ...s.enrichments[hex], route, routeLoading: false },
          },
        })),
      setRouteLoading: (hex, loading) =>
        set((s) => ({
          enrichments: {
            ...s.enrichments,
            [hex]: { ...emptyEnrichment(), ...s.enrichments[hex], routeLoading: loading },
          },
        })),

      setFollow: (v) => set({ followSelected: v }),

      nudgeSkyHeadingOffset: (delta) =>
        set((s) => ({ skyHeadingOffset: Math.round((((s.skyHeadingOffset + delta) % 360) + 360) % 360) })),
      resetSkyHeadingOffset: () => set({ skyHeadingOffset: 0 }),
    }),
    {
      name: "airspace-home",
      // only the chosen location + display prefs are durable; live data is re-fetched
      partialize: (s) => ({
        home: s.home,
        overlays: s.overlays,
        basemap: s.basemap,
        chartMode: s.chartMode,
        theme: s.theme,
        skyHeadingOffset: s.skyHeadingOffset,
      }),
    }
  )
);

function emptyEnrichment(): Enrichment {
  return { info: null, infoLoading: false, route: null, routeLoading: false };
}

export function selectAircraftByHex(
  state: AirspaceState,
  hex: string | null
): Aircraft | null {
  if (!hex || !state.frame) return null;
  return state.frame.aircraft.find((a) => a.hex === hex) ?? null;
}
