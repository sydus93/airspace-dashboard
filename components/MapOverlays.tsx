"use client";

import { useAirspace } from "@/store/useAirspace";
import { OVERLAYS, BASEMAPS } from "@/lib/mapLayers";

// Bottom-left map chrome: basemap switcher, weather raster toggles (NEXRAD radar,
// IR satellite), the airport-detail (runways/taxiways) toggle, and the altitude
// legend — the chart's own color logic.
const RAMP = ["#8aae6e", "#a8c890", "#c89858", "#c98a68", "#5fb8c4"];

export default function MapOverlays() {
  const overlays = useAirspace((s) => s.overlays);
  const toggle = useAirspace((s) => s.toggleOverlay);
  const basemap = useAirspace((s) => s.basemap);
  const setBasemap = useAirspace((s) => s.setBasemap);

  return (
    <div className="map-chrome">
      <div className="basemap-switch" role="group" aria-label="basemap">
        {BASEMAPS.map((b) => (
          <button
            key={b.id}
            className={`bm-btn ${basemap === b.id ? "on" : ""}`}
            onClick={() => setBasemap(b.id)}
            aria-pressed={basemap === b.id}
          >
            {b.label}
          </button>
        ))}
      </div>

      {OVERLAYS.map((o) => (
        <button
          key={o.id}
          className={`layer-btn ${overlays[o.id] ? "on" : ""}`}
          onClick={() => toggle(o.id)}
          aria-pressed={!!overlays[o.id]}
          title={o.label}
        >
          <span className="layer-dot" />
          {o.label}
        </button>
      ))}

      <button
        className={`layer-btn ${overlays.airports ? "on" : ""}`}
        onClick={() => toggle("airports")}
        aria-pressed={!!overlays.airports}
        title="Runways, taxiways & aprons (zoom in)"
      >
        <span className="layer-dot" />
        Airport detail
      </button>

      <div className="alt-legend" aria-hidden>
        <span className="lg-lbl">Alt</span>
        <span className="lg-ramp">
          {RAMP.map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </span>
        <span className="lg-range">GND → 30k+</span>
      </div>
    </div>
  );
}
