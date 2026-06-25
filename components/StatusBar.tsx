"use client";

import { useEffect, useState } from "react";
import { useAirspace } from "@/store/useAirspace";
import { isNotable, timeAgo } from "@/lib/format";

export default function StatusBar({
  onToggleWeather,
  weatherOpen,
  onOpenLocation,
}: {
  onToggleWeather: () => void;
  weatherOpen: boolean;
  onOpenLocation: () => void;
}) {
  const frame = useAirspace((s) => s.frame);
  const stale = useAirspace((s) => s.trafficStale);
  const lastAt = useAirspace((s) => s.lastTrafficAt);
  const home = useAirspace((s) => s.home);

  // tick so "Xs ago" stays fresh
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const count = frame?.aircraft.length ?? 0;
  const notable = frame?.aircraft.filter(isNotable).length ?? 0;
  const live = lastAt > 0 && !stale;

  return (
    <header className="statusbar">
      <button className="sb-left" onClick={onOpenLocation} aria-label="change scan location">
        <span className={`sb-dot ${live ? "live" : "stale"}`} aria-hidden />
        <div className="sb-title">
          <strong>AIRSPACE</strong>
          <span className="sb-home">{home.label} · {home.radiusNm} nm ▾</span>
        </div>
      </button>

      <div className="sb-right">
        <div className="sb-stat">
          <span className="sb-num">{count}</span>
          <span className="sb-lbl">aircraft</span>
        </div>
        {notable > 0 && (
          <div className="sb-alert" title="notable contacts">
            ⚠ {notable}
          </div>
        )}
        <div className="sb-age">
          {lastAt > 0 ? timeAgo(lastAt) : "connecting…"}
          {stale && <span className="sb-stale-tag">STALE</span>}
        </div>
        <button
          className={`sb-wx ${weatherOpen ? "on" : ""}`}
          onClick={onToggleWeather}
          aria-pressed={weatherOpen}
        >
          WX
        </button>
      </div>
    </header>
  );
}
