"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as L from "leaflet";
import { useAirspace, type HomePoint } from "@/store/useAirspace";
import { markerColor, isEmergency, isNotable, aircraftLabel } from "@/lib/format";
import { getBasemap, OVERLAYS } from "@/lib/mapLayers";
import type { Aircraft, FlightRoute, AirportLayout } from "@/lib/types";

const NM_TO_M = 1852;

// Phones bog down compositing hundreds of DOM markers per frame, so a busy scan
// (e.g. 150 nm near a hub = 500+ contacts) renders only the nearest N — plus any
// selected or notable contact, always kept. The status count still shows the true
// total; this only bounds what's drawn.
const MAX_MARKERS = 200;

// Below this zoom the OSM aeroway detail is too coarse to be useful (and the
// bbox too large), so we show a "zoom in" hint instead of fetching.
const AIRPORT_MIN_Z = 13;

function renderAirportLayer(Lm: typeof L, layer: L.LayerGroup, data: AirportLayout) {
  layer.clearLayers();
  const order = { apron: 0, taxiway: 1, runway: 2 };
  const feats = [...data.features].sort((a, b) => order[a.kind] - order[b.kind]);
  for (const f of feats) {
    if (f.kind === "apron") {
      Lm.polygon(f.coords, {
        color: "#5a564f", weight: 0.6, opacity: 0.45,
        fillColor: "#8a8278", fillOpacity: 0.12, interactive: false,
      }).addTo(layer);
    } else if (f.kind === "taxiway") {
      Lm.polyline(f.coords, { color: "#a29d91", weight: 1.6, opacity: 0.55, interactive: false }).addTo(layer);
    } else {
      const pl = Lm.polyline(f.coords, {
        color: "#f4ecd8", weight: 4, opacity: 0.9, lineCap: "butt", interactive: false,
      }).addTo(layer);
      if (f.ref) pl.bindTooltip(f.ref, { permanent: true, direction: "center", className: "rwy-label" });
    }
  }
}

function capMarkers(all: Aircraft[], selectedHex: string | null): Aircraft[] {
  if (all.length <= MAX_MARKERS) return all;
  const keep: Aircraft[] = [];
  const rest: Aircraft[] = [];
  for (const a of all) {
    if (a.hex === selectedHex || isNotable(a)) keep.push(a);
    else rest.push(a);
  }
  rest.sort((x, y) => (x.distanceNm ?? Infinity) - (y.distanceNm ?? Infinity));
  return keep.concat(rest).slice(0, MAX_MARKERS);
}

// top-down plane silhouette pointing north (rotated by CSS to the track angle)
function planeSvg(): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2c.62 0 1 .92 1 2.45V9l8 4.6v1.8l-8-2.55v4.3l2.2 1.65v1.3L12 19.1l-3.2 1.05v-1.3L11 17.15v-4.3L3 15.4v-1.8L11 9V4.45C11 2.92 11.38 2 12 2z"/></svg>`;
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const readyRef = useRef(false);
  const lastHomeRef = useRef<HomePoint | null>(null);

  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const homeLayerRef = useRef<L.LayerGroup | null>(null);
  const acLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const overlayLayersRef = useRef<Map<string, L.TileLayer>>(new Map());
  const refreshTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const baseRef = useRef<L.TileLayer | null>(null);
  const baseIdRef = useRef<string>("");
  const airportLayerRef = useRef<L.LayerGroup | null>(null);
  const airportKeyRef = useRef<string>("");
  const LRef = useRef<typeof L | null>(null);

  const [tilesOk, setTilesOk] = useState(true);
  const [lightBase, setLightBase] = useState(false);
  const [airportHint, setAirportHint] = useState(false);

  function ringBounds(h: HomePoint): [[number, number], [number, number]] {
    const dLat = h.radiusNm / 60;
    const dLon = h.radiusNm / 60 / Math.cos((h.lat * Math.PI) / 180);
    return [
      [h.lat - dLat, h.lon - dLon],
      [h.lat + dLat, h.lon + dLon],
    ];
  }

  function pushHome(fit: boolean) {
    const Lm = LRef.current;
    const map = mapRef.current;
    const layer = homeLayerRef.current;
    if (!Lm || !map || !layer || !readyRef.current) return;
    const h = useAirspace.getState().home;
    layer.clearLayers();
    for (const f of [0.34, 0.67, 1]) {
      Lm.circle([h.lat, h.lon], {
        radius: h.radiusNm * NM_TO_M * f,
        color: "#ece7d8",
        weight: f === 1 ? 1 : 0.8,
        opacity: f === 1 ? 0.22 : 0.12,
        dashArray: "3 5",
        fill: false,
        interactive: false,
      }).addTo(layer);
    }
    Lm.circleMarker([h.lat, h.lon], {
      radius: 4, color: "#a8c890", fillColor: "#a8c890", fillOpacity: 0.9, weight: 1, interactive: false,
    }).addTo(layer);
    if (fit) {
      const b = ringBounds(h);
      map.fitBounds(b, { padding: [40, 40], maxZoom: 11, animate: true });
    }
  }

  function styleMarker(m: L.Marker, ac: Aircraft, selected: boolean) {
    const root = m.getElement();
    if (!root) return;
    root.classList.toggle("selected", selected);
    root.classList.toggle("emergency", isEmergency(ac));
    const plane = root.querySelector(".ac-plane") as HTMLElement | null;
    if (plane) {
      plane.style.transform = `rotate(${ac.trackDeg ?? 0}deg)`;
      plane.style.color = markerColor(ac, selected);
    }
    const tag = root.querySelector(".ac-tag") as HTMLElement | null;
    if (tag) tag.textContent = selected || isNotable(ac) ? aircraftLabel(ac) : "";
  }

  function pushAircraft() {
    const Lm = LRef.current;
    const layer = acLayerRef.current;
    if (!Lm || !layer || !readyRef.current) return;
    const { frame, selectedHex } = useAirspace.getState();
    const list = capMarkers(frame?.aircraft ?? [], selectedHex);
    const seen = new Set<string>();
    for (const ac of list) {
      seen.add(ac.hex);
      let m = markersRef.current.get(ac.hex);
      if (!m) {
        const hex = ac.hex;
        const icon = Lm.divIcon({
          className: "ac-divicon",
          html: `<span class="ac-plane">${planeSvg()}</span><span class="ac-tag"></span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        m = Lm.marker([ac.lat, ac.lon], { icon, keyboard: false });
        // Leaflet does not bubble marker clicks to the map's click (deselect).
        m.on("click", () => useAirspace.getState().select(hex));
        m.addTo(layer);
        markersRef.current.set(ac.hex, m);
      } else {
        m.setLatLng([ac.lat, ac.lon]);
      }
      styleMarker(m, ac, ac.hex === selectedHex);
    }
    for (const [hex, m] of markersRef.current) {
      if (!seen.has(hex)) {
        layer.removeLayer(m);
        markersRef.current.delete(hex);
      }
    }
  }

  function pushRoute() {
    const Lm = LRef.current;
    const layer = routeLayerRef.current;
    if (!Lm || !layer || !readyRef.current) return;
    layer.clearLayers();
    const st = useAirspace.getState();
    const ac = st.frame?.aircraft.find((a) => a.hex === st.selectedHex) ?? null;
    const route: FlightRoute | null = st.selectedHex
      ? st.enrichments[st.selectedHex]?.route ?? null
      : null;
    if (route?.origin && route?.destination) {
      Lm.polyline(
        [
          [route.origin.lat, route.origin.lon],
          [route.destination.lat, route.destination.lon],
        ],
        { color: "#a8c890", weight: 1.5, opacity: 0.7, dashArray: "4 4", interactive: false }
      ).addTo(layer);
      for (const ap of [route.origin, route.destination]) {
        Lm.circleMarker([ap.lat, ap.lon], {
          radius: 5, color: "#a8c890", weight: 1.5, fillColor: "#0e0f12", fillOpacity: 1, interactive: false,
        })
          .addTo(layer)
          .bindTooltip(ap.iata || ap.icao, { permanent: true, direction: "top", className: "ap-tip", offset: [0, -4] });
      }
    }
    if (ac && route?.destination) {
      Lm.polyline(
        [
          [ac.lat, ac.lon],
          [route.destination.lat, route.destination.lon],
        ],
        { color: "#a8c890", weight: 1, opacity: 0.5, dashArray: "3 4", interactive: false }
      ).addTo(layer);
    }
  }

  function applyBasemap() {
    const Lm = LRef.current;
    const map = mapRef.current;
    if (!Lm || !map) return;
    const id = useAirspace.getState().basemap;
    if (id === baseIdRef.current && baseRef.current) return;
    const def = getBasemap(id);
    // Leaflet won't issue requests for a root-relative tile template; resolve our
    // same-origin proxy URL to an absolute one against the page origin.
    const url =
      def.url.startsWith("/") && typeof window !== "undefined"
        ? window.location.origin + def.url
        : def.url;
    const next = Lm.tileLayer(url, {
      // never pass undefined — it overrides Leaflet's default 'abc' and then
      // _getSubdomain() throws on `.length` for templates without an {s} token
      subdomains: def.subdomains ?? "abc",
      attribution: def.attribution,
      maxZoom: def.maxZoom,
      maxNativeZoom: def.maxNativeZoom,
      minNativeZoom: def.minNativeZoom,
      detectRetina: !!def.detectRetina,
      zIndex: 0,
    });
    let tileFails = 0;
    next.on("tileerror", () => {
      if (++tileFails > 6) setTilesOk(false);
    });
    next.on("load", () => setTilesOk(true));
    next.addTo(map);
    // keep the old base until the new one paints, to avoid a flash to bg color
    const prev = baseRef.current;
    const dropPrev = () => {
      if (prev && map.hasLayer(prev)) map.removeLayer(prev);
    };
    next.once("load", dropPrev);
    setTimeout(dropPrev, 1500);
    baseRef.current = next;
    baseIdRef.current = id;
    setLightBase(!!def.light);
    setTilesOk(true);
  }

  function syncOverlays() {
    const Lm = LRef.current;
    const map = mapRef.current;
    if (!Lm || !map || !readyRef.current) return;
    const ov = useAirspace.getState().overlays;
    for (const def of OVERLAYS) {
      const on = !!ov[def.id];
      const existing = overlayLayersRef.current.get(def.id);
      if (on && !existing) {
        const tl = Lm.tileLayer(def.url, {
          opacity: def.opacity,
          attribution: def.attribution,
          ...(def.subdomains ? { subdomains: def.subdomains } : {}),
          zIndex: 200,
        }).addTo(map);
        overlayLayersRef.current.set(def.id, tl);
        if (def.refreshMs > 0) {
          refreshTimersRef.current.set(def.id, setInterval(() => tl.redraw(), def.refreshMs));
        }
      } else if (!on && existing) {
        map.removeLayer(existing);
        overlayLayersRef.current.delete(def.id);
        const t = refreshTimersRef.current.get(def.id);
        if (t) clearInterval(t);
        refreshTimersRef.current.delete(def.id);
      }
    }
  }

  async function syncAirports() {
    const Lm = LRef.current;
    const map = mapRef.current;
    const layer = airportLayerRef.current;
    if (!Lm || !map || !layer || !readyRef.current) return;
    const on = useAirspace.getState().overlays.airports;
    if (!on) {
      if (airportKeyRef.current) {
        layer.clearLayers();
        airportKeyRef.current = "";
      }
      setAirportHint(false);
      return;
    }
    if (map.getZoom() < AIRPORT_MIN_Z) {
      if (airportKeyRef.current) {
        layer.clearLayers();
        airportKeyRef.current = "";
      }
      setAirportHint(true);
      return;
    }
    setAirportHint(false);
    const b = map.getBounds();
    const bbox: [number, number, number, number] = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
    const key = bbox.map((x) => x.toFixed(2)).join(",");
    if (key === airportKeyRef.current) return; // already showing this area
    airportKeyRef.current = key;
    try {
      const res = await fetch(`/api/airport-layout?bbox=${bbox.join(",")}`);
      const env = (await res.json()) as { data: AirportLayout };
      // bail if the user toggled off or panned away while we were fetching
      if (!useAirspace.getState().overlays.airports || airportKeyRef.current !== key) return;
      renderAirportLayer(Lm, layer, env.data);
    } catch {
      airportKeyRef.current = ""; // allow a retry on next move
    }
  }

  // init once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      const Lm = (mod.default ?? mod) as typeof L;
      if (cancelled || !containerRef.current) return;
      LRef.current = Lm;
      const h = useAirspace.getState().home;
      lastHomeRef.current = h;

      const map = Lm.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        preferCanvas: false,
        worldCopyJump: true,
      }).setView([h.lat, h.lon], 8);
      mapRef.current = map;

      applyBasemap();

      Lm.control.zoom({ position: "bottomright" }).addTo(map);

      homeLayerRef.current = Lm.layerGroup().addTo(map);
      airportLayerRef.current = Lm.layerGroup().addTo(map);
      routeLayerRef.current = Lm.layerGroup().addTo(map);
      acLayerRef.current = Lm.layerGroup().addTo(map);

      map.on("click", () => useAirspace.getState().select(null));
      map.on("moveend", () => {
        const c = map.getCenter();
        useAirspace.getState().setMapCenter(c.lat, c.lng);
        syncAirports();
      });

      readyRef.current = true;
      pushHome(true);
      pushAircraft();
      pushRoute();
      syncOverlays();
      syncAirports();
      // Leaflet sometimes needs a nudge if the container sized after init
      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      cancelled = true;
      for (const t of refreshTimersRef.current.values()) clearInterval(t);
      refreshTimersRef.current.clear();
      overlayLayersRef.current.clear();
      markersRef.current.clear();
      // reset basemap/airport identity so a StrictMode remount rebuilds them on
      // the new map (else applyBasemap early-returns and the map has no tiles)
      baseRef.current = null;
      baseIdRef.current = "";
      airportKeyRef.current = "";
      readyRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // react to store changes
  useEffect(() => {
    const unsub = useAirspace.subscribe((state) => {
      applyBasemap();
      pushAircraft();
      pushRoute();
      syncOverlays();
      syncAirports();
      if (state.home !== lastHomeRef.current) {
        lastHomeRef.current = state.home;
        pushHome(true);
      }
    });
    return unsub;
  }, []);

  // when the map is revealed (SECTIONAL mode), it may have been sized while the
  // scope overlay covered it — nudge Leaflet to recompute its viewport.
  const chartMode = useAirspace((s) => s.chartMode);
  useEffect(() => {
    if (chartMode !== "sectional") return;
    const id = setTimeout(() => mapRef.current?.invalidateSize(), 60);
    return () => clearTimeout(id);
  }, [chartMode]);

  // follow selected
  const selectedHex = useAirspace((s) => s.selectedHex);
  const follow = useAirspace((s) => s.followSelected);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow || !selectedHex) return;
    const ac = useAirspace.getState().frame?.aircraft.find((a) => a.hex === selectedHex);
    if (ac) map.panTo([ac.lat, ac.lon], { animate: true });
  }, [selectedHex, follow]);

  return (
    <div className={`map-wrap${lightBase ? " basemap-light" : ""}`}>
      <div ref={containerRef} className="map-root" />
      {/* VOR sweep — the one ambient motion (leading arm + trailing afterglow) */}
      <div className="vor-sweep" aria-hidden>
        <div className="sweep-rot">
          <div className="sweep-trail" />
          <div className="sweep-arm" />
        </div>
      </div>
      {!tilesOk && (
        <div className="map-note subtle">Basemap tiles unavailable — traffic still live.</div>
      )}
      {airportHint && (
        <div className="map-note subtle">Zoom in over an airport to see runways &amp; taxiways.</div>
      )}
    </div>
  );
}
