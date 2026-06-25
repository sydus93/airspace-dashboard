"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as L from "leaflet";
import { useAirspace, type HomePoint } from "@/store/useAirspace";
import { altitudeColor, isNotable, aircraftLabel } from "@/lib/format";
import { BASEMAP, OVERLAYS } from "@/lib/mapLayers";
import type { Aircraft, FlightRoute } from "@/lib/types";

const NM_TO_M = 1852;

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
  const LRef = useRef<typeof L | null>(null);

  const [tilesOk, setTilesOk] = useState(true);

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
        color: "#3fd6c8",
        weight: f === 1 ? 1.4 : 1,
        opacity: f === 1 ? 0.5 : 0.22,
        dashArray: "4 5",
        fill: false,
        interactive: false,
      }).addTo(layer);
    }
    Lm.circleMarker([h.lat, h.lon], {
      radius: 4, color: "#3fd6c8", fillColor: "#3fd6c8", fillOpacity: 0.9, weight: 1, interactive: false,
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
    root.classList.toggle("notable", isNotable(ac));
    const plane = root.querySelector(".ac-plane") as HTMLElement | null;
    if (plane) {
      plane.style.transform = `rotate(${ac.trackDeg ?? 0}deg)`;
      plane.style.color = altitudeColor(ac);
    }
    const tag = root.querySelector(".ac-tag") as HTMLElement | null;
    if (tag) tag.textContent = selected || isNotable(ac) ? aircraftLabel(ac) : "";
  }

  function pushAircraft() {
    const Lm = LRef.current;
    const layer = acLayerRef.current;
    if (!Lm || !layer || !readyRef.current) return;
    const { frame, selectedHex } = useAirspace.getState();
    const list = frame?.aircraft ?? [];
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
        { color: "#f5d142", weight: 2, opacity: 0.8, interactive: false }
      ).addTo(layer);
      for (const ap of [route.origin, route.destination]) {
        Lm.circleMarker([ap.lat, ap.lon], {
          radius: 5, color: "#f5d142", weight: 2, fillColor: "#0a0e14", fillOpacity: 1, interactive: false,
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
        { color: "#f5d142", weight: 1, opacity: 0.5, dashArray: "3 4", interactive: false }
      ).addTo(layer);
    }
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

      const base = Lm.tileLayer(BASEMAP.url, {
        subdomains: BASEMAP.subdomains,
        attribution: BASEMAP.attribution,
        maxZoom: BASEMAP.maxZoom,
        detectRetina: true,
      }).addTo(map);
      let tileFails = 0;
      base.on("tileerror", () => {
        if (++tileFails > 4) setTilesOk(false);
      });
      base.on("load", () => setTilesOk(true));

      Lm.control.zoom({ position: "bottomright" }).addTo(map);

      homeLayerRef.current = Lm.layerGroup().addTo(map);
      routeLayerRef.current = Lm.layerGroup().addTo(map);
      acLayerRef.current = Lm.layerGroup().addTo(map);

      map.on("click", () => useAirspace.getState().select(null));
      map.on("moveend", () => {
        const c = map.getCenter();
        useAirspace.getState().setMapCenter(c.lat, c.lng);
      });

      readyRef.current = true;
      pushHome(true);
      pushAircraft();
      pushRoute();
      syncOverlays();
      // Leaflet sometimes needs a nudge if the container sized after init
      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      cancelled = true;
      for (const t of refreshTimersRef.current.values()) clearInterval(t);
      refreshTimersRef.current.clear();
      overlayLayersRef.current.clear();
      markersRef.current.clear();
      readyRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // react to store changes
  useEffect(() => {
    const unsub = useAirspace.subscribe((state) => {
      pushAircraft();
      pushRoute();
      syncOverlays();
      if (state.home !== lastHomeRef.current) {
        lastHomeRef.current = state.home;
        pushHome(true);
      }
    });
    return unsub;
  }, []);

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
    <div className="map-wrap">
      <div ref={containerRef} className="map-root" />
      {!tilesOk && (
        <div className="map-note subtle">Basemap tiles unavailable — traffic still live.</div>
      )}
    </div>
  );
}
