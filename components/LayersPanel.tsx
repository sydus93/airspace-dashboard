"use client";

import { useAirspace } from "@/store/useAirspace";
import { OVERLAYS, BASEMAPS } from "@/lib/mapLayers";

// LYR — the layers panel. Basemap for the SECTIONAL (map) view plus weather-raster
// and airport-detail overlays. Replaces the old always-on map chrome.
export default function LayersPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const overlays = useAirspace((s) => s.overlays);
  const toggle = useAirspace((s) => s.toggleOverlay);
  const basemap = useAirspace((s) => s.basemap);
  const setBasemap = useAirspace((s) => s.setBasemap);
  const chartMode = useAirspace((s) => s.chartMode);

  if (!open) return null;

  const rows = [
    ...OVERLAYS.map((o) => ({ id: o.id, label: o.label })),
    { id: "airports", label: "Airport detail" },
  ];

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="panel top" role="dialog" aria-label="Layers">
        <div className="panel-hatch" />
        <div className="panel-head">
          <span className="panel-title">LAYERS</span>
          <button className="icon-btn" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className="panel-body panel-pad">
          <div className="lyr-section-lbl">
            Basemap{chartMode === "radar" ? " · shown in SECTIONAL" : ""}
          </div>
          <div className="lyr-seg" role="group" aria-label="basemap">
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                className={`lyr-seg-btn ${basemap === b.id ? "on" : ""}`}
                onClick={() => setBasemap(b.id)}
                aria-pressed={basemap === b.id}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div className="lyr-section-lbl">Overlays</div>
          {rows.map((r) => (
            <button
              key={r.id}
              className={`lyr-toggle ${overlays[r.id] ? "on" : ""}`}
              onClick={() => toggle(r.id)}
              aria-pressed={!!overlays[r.id]}
            >
              <span className="lyr-toggle-dot" />
              {r.label}
              <span className="lyr-toggle-state">{overlays[r.id] ? "ON" : "OFF"}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
