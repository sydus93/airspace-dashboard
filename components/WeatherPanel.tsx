"use client";

import { useState } from "react";
import { useAirspace } from "@/store/useAirspace";
import { isoTimeAgo } from "@/lib/format";
import type { Metar } from "@/lib/types";

function windText(m: Metar): string {
  if (m.windSpeedKt === null || m.windSpeedKt === 0) return "calm";
  const dir = m.windVariable || m.windDirDeg === null ? "VRB" : `${String(m.windDirDeg).padStart(3, "0")}°`;
  const gust = m.windGustKt ? `G${m.windGustKt}` : "";
  return `${dir} / ${m.windSpeedKt}${gust} kt`;
}

function MetarRow({ m }: { m: Metar }) {
  const [open, setOpen] = useState(false);
  const cat = m.flightCategory ?? "none";
  return (
    <div className="wx-row-card" onClick={() => setOpen((o) => !o)}>
      <div className="wx-row-top">
        <span className="wx-icao">{m.icaoId}</span>
        <span className={`wx-cat ${cat}`}>{m.flightCategory ?? "—"}</span>
      </div>
      <div className="wx-metrics">
        <span title="wind">{windText(m)}</span>
        <span title="visibility">{m.visibilityText ?? "—"} sm</span>
        <span title="temp / dewpoint">{m.tempC ?? "—"}° / {m.dewpointC ?? "—"}°</span>
        <span title="altimeter">{m.altimeterInHg ? `${m.altimeterInHg.toFixed(2)}"` : "—"}</span>
      </div>
      {m.wxString && <div className="wx-wxstr">{m.wxString}</div>}
      {open && <div className="wx-raw">{m.raw}</div>}
      <div className="wx-age">{isoTimeAgo(m.observedAt)}</div>
    </div>
  );
}

export default function WeatherPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const metars = useAirspace((s) => s.metars);
  const stale = useAirspace((s) => s.weatherStale);
  const error = useAirspace((s) => s.weatherError);

  if (!open) return null;

  return (
    <aside className={`weather-panel glass ${stale ? "stale" : ""}`}>
      <div className="wx-header">
        <span className="panel-kicker">Weather{stale ? " · stale" : ""}</span>
        <button className="icon-btn" onClick={onClose} aria-label="close weather">✕</button>
      </div>
      {error && metars.length === 0 && (
        <div className="wx-empty">Weather source unavailable — {error}</div>
      )}
      {metars.length === 0 && !error && <div className="wx-empty">Loading METARs…</div>}
      <div className="wx-list">
        {metars.map((m) => (
          <MetarRow key={m.icaoId} m={m} />
        ))}
      </div>
    </aside>
  );
}
