"use client";

import { useEffect, useState } from "react";
import { useAirspace } from "@/store/useAirspace";
import { isNotable } from "@/lib/format";

// Header — the instrument masthead. Hatched rule, AIRSPACE wordmark + live pulse,
// the scan-scope line (tap to change location), and the in-range contact count.
export default function StatusBar({ onOpenLocation }: { onOpenLocation: () => void }) {
  const frame = useAirspace((s) => s.frame);
  const stale = useAirspace((s) => s.trafficStale);
  const lastAt = useAirspace((s) => s.lastTrafficAt);
  const home = useAirspace((s) => s.home);

  const [zulu, setZulu] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setZulu(new Date().toISOString().slice(11, 19) + "Z");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const count = frame?.aircraft.length ?? 0;
  const notable = frame?.aircraft.filter(isNotable).length ?? 0;
  const live = lastAt > 0 && !stale;
  const coord = `${Math.abs(home.lat).toFixed(2)}${home.lat >= 0 ? "N" : "S"} ${Math.abs(home.lon)
    .toFixed(2)
    .padStart(5, "0")}${home.lon >= 0 ? "E" : "W"}`;

  return (
    <header className="topstrip">
      <div className="ts-hatch" />

      <div className="ts-row">
        <button className="ts-brand" onClick={onOpenLocation} aria-label="change scan location">
          <svg className="ts-mark" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M6 0v12M0 6h12" stroke="#ece7d8" strokeWidth="0.8" />
            <circle cx="6" cy="6" r="3.4" fill="none" stroke="#ece7d8" strokeWidth="0.8" />
          </svg>
          <span className="ts-wordmark">AIRSPACE</span>
        </button>
        <div className="ts-live">
          <span className={`ts-live-dot ${live ? "live" : ""}`} aria-hidden />
          <span className={`ts-live-lbl ${live ? "live" : ""}`}>
            {live ? "LIVE" : stale ? "STALE" : "…"}
          </span>
          <span className="ts-hz">· 1 Hz</span>
        </div>
      </div>

      <button className="ts-scope" onClick={onOpenLocation} aria-label="change scan location">
        <span className="ts-scope-main">
          SCOPE · {home.label} · R{String(home.radiusNm).padStart(3, "0")} · {coord} ▾
        </span>
        <span className="ts-zulu">{zulu}</span>
      </button>

      <div className="ts-rule" />

      <div className="ts-count-row">
        <div className="ts-count">
          <span className="ts-count-num">{count}</span>
          <span className="ts-count-lbl">contacts / in range</span>
        </div>
        {notable > 0 && <span className="ts-priority">▲ {notable} PRIORITY</span>}
      </div>
    </header>
  );
}
