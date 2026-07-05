"use client";

import { useState } from "react";
import { useAirspace } from "@/store/useAirspace";
import { config } from "@/lib/config";

export default function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const home = useAirspace((s) => s.home);
  const mapCenter = useAirspace((s) => s.mapCenter);
  const setHome = useAirspace((s) => s.setHome);
  const setRadius = useAirspace((s) => s.setRadius);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  if (!open) return null;

  const locateMe = () => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("Geolocation not available");
      return;
    }
    setGeoStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHome(pos.coords.latitude, pos.coords.longitude, { label: "My location" });
        setGeoStatus(null);
        onClose();
      },
      (err) => setGeoStatus(err.message || "Location denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const scanMapCenter = () => {
    if (!mapCenter) return;
    setHome(mapCenter.lat, mapCenter.lon, { label: "Map center" });
    onClose();
  };

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="panel top" role="dialog" aria-label="Scan location">
        <div className="panel-hatch" />
        <div className="panel-head">
          <span className="panel-title">SCAN AREA</span>
          <button className="icon-btn" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className="panel-body panel-pad">
          <div className="loc-current">
            <span className="loc-coord">
              {home.lat.toFixed(4)}, {home.lon.toFixed(4)}
            </span>
            <span className="loc-label">{home.label}</span>
          </div>

          <div className="loc-actions">
            <button className="loc-btn" onClick={locateMe}>
              ◎ MY LOCATION
            </button>
            <button className="loc-btn" onClick={scanMapCenter} disabled={!mapCenter}>
              ⊕ MAP CENTER
            </button>
          </div>
          {geoStatus && <div className="loc-geo">{geoStatus}</div>}

          <div className="loc-radius-top">
            <span className="loc-radius-lbl">Radius</span>
            <span className="loc-radius-val">{home.radiusNm} nm</span>
          </div>
          <input
            className="loc-slider"
            type="range"
            min={10}
            max={250}
            step={5}
            value={home.radiusNm}
            onChange={(e) => setRadius(Number(e.target.value))}
            aria-label="radius nm"
          />

          <div className="loc-presets-lbl">Presets</div>
          {config.presets.map((p) => (
            <button
              key={p.label}
              className="loc-preset"
              onClick={() => {
                setHome(p.lat, p.lon, { radiusNm: p.radiusNm, label: p.label });
                onClose();
              }}
            >
              <span className="loc-preset-lbl">{p.label}</span>
              <span className="loc-preset-rng">{p.radiusNm} nm →</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
