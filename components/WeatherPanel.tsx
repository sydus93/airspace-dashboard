"use client";

import { useState } from "react";
import { useAirspace } from "@/store/useAirspace";
import { isoTimeAgo } from "@/lib/format";
import type { Metar } from "@/lib/types";

const SEV: Record<string, number> = { VFR: 1, MVFR: 2, IFR: 3, LIFR: 4 };

function windText(m: Metar): string {
  if (m.windSpeedKt === null || m.windSpeedKt === 0) return "calm";
  const dir = m.windVariable || m.windDirDeg === null ? "VRB" : `${String(m.windDirDeg).padStart(3, "0")}°`;
  const gust = m.windGustKt ? `G${m.windGustKt}` : "";
  return `${dir} / ${m.windSpeedKt}${gust} kt`;
}

function MetarRow({ m }: { m: Metar }) {
  const [open, setOpen] = useState(false);
  const cat = m.flightCategory ?? "none";
  const sev = SEV[cat] ?? 0;
  return (
    <div className="wx-row" onClick={() => setOpen((o) => !o)}>
      <div className="wx-top">
        <span className="wx-icao">{m.icaoId}</span>
        <div className="wx-cat-wrap">
          <span className={`wx-cat ${cat}`}>{m.flightCategory ?? "—"}</span>
          <span className="wx-sev">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={n <= sev ? "on" : "off"} />
            ))}
          </span>
        </div>
      </div>
      <div className="wx-metrics">
        <span>{windText(m)}</span>
        <span>{m.visibilityText ?? "—"} sm</span>
        <span>
          {m.tempC ?? "—"}° / {m.dewpointC ?? "—"}°
        </span>
        <span>{m.altimeterInHg ? `${m.altimeterInHg.toFixed(2)}"` : "—"}</span>
      </div>
      {m.wxString && <div className="wx-wxstr">{m.wxString}</div>}
      {open && <div className="wx-raw">{m.raw}</div>}
      <div className="wx-age">{isoTimeAgo(m.observedAt)}</div>
    </div>
  );
}

export default function WeatherPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const metars = useAirspace((s) => s.metars);
  const stale = useAirspace((s) => s.weatherStale);
  const error = useAirspace((s) => s.weatherError);

  if (!open) return null;

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <aside className="panel wx" role="dialog" aria-label="Weather">
        <div className="panel-hatch" />
        <div className="panel-head">
          <div style={{ whiteSpace: "nowrap" }}>
            <span className="panel-title">WEATHER · METAR</span>
            {stale && <span className="panel-sub">STALE</span>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="close weather">
            ✕
          </button>
        </div>
        <div className="panel-body">
          {error && metars.length === 0 && (
            <div className="wx-empty">Weather source unavailable — {error}</div>
          )}
          {metars.length === 0 && !error && <div className="wx-empty">Loading METARs…</div>}
          {metars.map((m) => (
            <MetarRow key={m.icaoId} m={m} />
          ))}
        </div>
      </aside>
    </>
  );
}
