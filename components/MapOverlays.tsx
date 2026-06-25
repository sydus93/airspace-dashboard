"use client";

import { useAirspace } from "@/store/useAirspace";
import { OVERLAYS } from "@/lib/mapLayers";

// Toggle weather raster overlays (NEXRAD radar, IR satellite) on the map.
export default function MapOverlays() {
  const overlays = useAirspace((s) => s.overlays);
  const toggle = useAirspace((s) => s.toggleOverlay);

  return (
    <div className="overlay-ctrl">
      {OVERLAYS.map((o) => (
        <button
          key={o.id}
          className={`overlay-btn ${overlays[o.id] ? "on" : ""}`}
          onClick={() => toggle(o.id)}
          aria-pressed={!!overlays[o.id]}
          title={o.label}
        >
          <span className="overlay-dot" />
          {o.label}
        </button>
      ))}
    </div>
  );
}
