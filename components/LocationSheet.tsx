"use client";

import { useState } from "react";
import { useAirspace } from "@/store/useAirspace";
import { config } from "@/lib/config";

export default function LocationSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
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
      <div className="loc-sheet glass no-strip" role="dialog" aria-label="Location">
        <div className="loc-head">
          <span className="panel-kicker">Scan location</span>
          <button className="icon-btn" onClick={onClose} aria-label="close">✕</button>
        </div>

        <div className="loc-current">
          <span className="loc-coord">
            {home.lat.toFixed(4)}, {home.lon.toFixed(4)}
          </span>
          <span className="loc-label">{home.label}</span>
        </div>

        <div className="loc-actions">
          <button className="loc-btn primary" onClick={locateMe}>📍 Use my location</button>
          <button className="loc-btn" onClick={scanMapCenter} disabled={!mapCenter}>⊕ Scan map center</button>
        </div>
        {geoStatus && <div className="loc-geo">{geoStatus}</div>}

        <div className="loc-radius">
          <div className="loc-radius-top">
            <span>Radius</span>
            <span className="loc-radius-val">{home.radiusNm} nm</span>
          </div>
          <input
            type="range" min={10} max={250} step={5}
            value={home.radiusNm}
            onChange={(e) => setRadius(Number(e.target.value))}
            aria-label="radius nm"
          />
          <div className="loc-radius-ticks"><span>10</span><span>130</span><span>250</span></div>
        </div>

        <div className="loc-presets">
          <div className="loc-presets-label">Quick locations</div>
          <div className="loc-preset-grid">
            {config.presets.map((p) => (
              <button
                key={p.label}
                className="loc-preset"
                onClick={() => {
                  setHome(p.lat, p.lon, { radiusNm: p.radiusNm, label: p.label });
                  onClose();
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
