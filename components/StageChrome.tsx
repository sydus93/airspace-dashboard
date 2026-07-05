"use client";

import { useEffect, useState } from "react";
import { useAirspace } from "@/store/useAirspace";
import { ALT_RAMP, timeAgo } from "@/lib/format";

export type Panel = "sky" | "wx" | "lyr" | "location" | null;

// Overlay chrome that floats over the stage (scope or map): the RADAR/SECTIONAL
// toggle, a small telemetry cluster, the altitude-band legend, and the control
// rail. Mirrors the instrument-panel framing of the Airspace Mono design.

const LEGEND = [
  { i: 4, label: "25+" },
  { i: 3, label: "15–25" },
  { i: 2, label: "8–15" },
  { i: 1, label: "< 8" },
];

const RAIL: Array<{ key: Exclude<Panel, null>; glyph: string; label: string }> = [
  { key: "sky", glyph: "⌖", label: "SKY" },
  { key: "wx", glyph: "▚", label: "WX" },
  { key: "lyr", glyph: "◈", label: "LYR" },
];

export default function StageChrome({
  panel,
  setPanel,
}: {
  panel: Panel;
  setPanel: (p: Panel) => void;
}) {
  const chartMode = useAirspace((s) => s.chartMode);
  const setChartMode = useAirspace((s) => s.setChartMode);
  const home = useAirspace((s) => s.home);
  const stale = useAirspace((s) => s.trafficStale);
  const lastAt = useAirspace((s) => s.lastTrafficAt);
  const count = useAirspace((s) => s.frame?.aircraft.length ?? 0);

  // keep the "updated Xs ago" line fresh
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const tracking = lastAt > 0 && !stale;

  return (
    <div className="stage-chrome">
      {/* RADAR / SECTIONAL */}
      <div className="chart-seg" role="group" aria-label="chart mode">
        <button
          className={`chart-seg-btn${chartMode === "radar" ? " on" : ""}`}
          onClick={() => setChartMode("radar")}
        >
          RADAR
        </button>
        <button
          className={`chart-seg-btn${chartMode === "sectional" ? " on" : ""}`}
          onClick={() => setChartMode("sectional")}
        >
          SECTIONAL
        </button>
      </div>

      {/* telemetry cluster — radar mode only (would clutter the map) */}
      {chartMode === "radar" && (
        <div className="stage-status" aria-hidden>
          <div className="stat-line">
            <div className="stat-k">Status</div>
            <div className="stat-v accent">{tracking ? "TRACKING" : stale ? "STALE" : "…"}</div>
          </div>
          <div className="stat-line">
            <div className="stat-k">Feed</div>
            <div className="stat-v">ADS-B · 1090</div>
          </div>
          <div className="stat-line">
            <div className="stat-k">Range</div>
            <div className="stat-v">{home.radiusNm} nm</div>
          </div>
          <div className="stat-line">
            <div className="stat-k">Updated</div>
            <div className="stat-v">{lastAt > 0 ? timeAgo(lastAt) : "—"}</div>
          </div>
        </div>
      )}

      {/* altitude legend */}
      <div className="alt-legend" aria-hidden>
        <div className="lg-title">Alt · kft</div>
        <div className="lg-rows">
          {LEGEND.map((l) => (
            <div className="lg-row" key={l.i}>
              <span className="lg-swatch" style={{ background: ALT_RAMP[l.i] }} />
              <span className="lg-lbl">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* control rail */}
      <nav className="control-rail" aria-label="tools">
        {RAIL.map((r) => (
          <button
            key={r.key}
            className={`rail-btn${panel === r.key ? " on" : ""}`}
            onClick={() => setPanel(panel === r.key ? null : r.key)}
            aria-pressed={panel === r.key}
            title={r.label}
          >
            <span className="rail-glyph">{r.glyph}</span>
            <span className="rail-lbl">{r.label}</span>
          </button>
        ))}
      </nav>

      {/* count is surfaced for screen readers via the header; keep DOM tidy */}
      <span style={{ display: "none" }}>{count}</span>
    </div>
  );
}
