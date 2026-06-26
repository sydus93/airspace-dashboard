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
    <header className="topstrip">
      <button className="ts-left" onClick={onOpenLocation} aria-label="change scan location">
        <span className="ts-brand">
          <span className={`ts-dot ${live ? "live" : "stale"}`} aria-hidden />
          <span className="ts-wordmark">AIRSPACE</span>
        </span>
        <span className="ts-loc">
          {home.label} <span className="dim">· {home.radiusNm} nm ▾</span>
        </span>
      </button>

      <div className="ts-right">
        <div className="ts-count">
          <span className="ts-count-num">{count}</span>
          <span className="ts-count-lbl">aircraft</span>
        </div>
        {notable > 0 && (
          <span className="ts-notable" title="notable contacts">
            {notable}<span className="ts-notable-lbl"> notable</span>
          </span>
        )}
        <span className="ts-age">
          {lastAt > 0 ? timeAgo(lastAt) : "connecting…"}
          {stale && <span className="stale">STALE</span>}
        </span>
        <button
          className={`ts-wx ${weatherOpen ? "on" : ""}`}
          onClick={onToggleWeather}
          aria-pressed={weatherOpen}
        >
          WX
        </button>
      </div>
    </header>
  );
}
