"use client";

import { useAirspace } from "@/store/useAirspace";
import { OVERLAYS } from "@/lib/mapLayers";

// Bottom-left map chrome: the altitude legend (the chart's own color logic) and
// the weather raster layer toggles (NEXRAD radar, IR satellite).
const RAMP = ["#8aae6e", "#a8c890", "#c89858", "#c98a68", "#5fb8c4"];

export default function MapOverlays() {
  const overlays = useAirspace((s) => s.overlays);
  const toggle = useAirspace((s) => s.toggleOverlay);

  return (
    <div className="map-chrome">
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
