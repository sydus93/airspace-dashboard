"use client";

import { useState } from "react";
import { useAirspace } from "@/store/useAirspace";
import { aircraftLabel, altitudeColor, altitudeText, bearingText, markerColor } from "@/lib/format";
import type { Aircraft } from "@/lib/types";
import { identify } from "@/lib/aircraftTypes";

// Overhead — nearest contacts, closest first. An index-numbered log that reads
// like a strip listing; tap a row to select it on the scope/map.
export default function OverheadNow() {
  const frame = useAirspace((s) => s.frame);
  const selectedHex = useAirspace((s) => s.selectedHex);
  const select = useAirspace((s) => s.select);
  const [expanded, setExpanded] = useState(true);

  const byRange = (frame?.aircraft ?? [])
    .filter((a) => a.distanceNm !== null)
    .sort((a, b) => (a.distanceNm ?? 1e9) - (b.distanceNm ?? 1e9));

  const rows = byRange.slice(0, expanded ? 4 : 1);

  return (
    <section className="overhead">
      <button className="oh-head" onClick={() => setExpanded((e) => !e)}>
        <span className="oh-cap">OVERHEAD · NEAREST</span>
        <span className={`oh-chev ${expanded ? "open" : ""}`}>▾</span>
      </button>

      {rows.length === 0 ? (
        <div className="oh-empty">No traffic in range right now.</div>
      ) : (
        rows.map((ac, i) => (
          <button
            key={ac.hex}
            className={`oh-row ${ac.hex === selectedHex ? "sel" : ""}`}
            onClick={() => select(ac.hex)}
          >
            <span className="oh-idx">{String(i + 1).padStart(2, "0")}</span>
            <span className="oh-dot" style={{ background: markerColor(ac) }} />
            <span className="oh-call">{aircraftLabel(ac)}</span>
            <span className="oh-type">{typeLine(ac)}</span>
            {badge(ac)}
            <span className="oh-alt" style={{ color: altitudeColor(ac) }}>
              {altitudeText(ac).replace(" ft", "")}
            </span>
            <span className="oh-rng">
              {ac.distanceNm !== null ? `${ac.distanceNm.toFixed(0)}nm` : ""}
            </span>
          </button>
        ))
      )}
    </section>
  );
}

function typeLine(ac: Aircraft): string {
  const id = identify({
    typeCode: ac.typeCode,
    description: ac.description,
    category: ac.category,
    isMilitary: ac.isMilitary,
  });
  return id.info ? id.name : ac.description || ac.typeCode || "Unknown type";
}

function badge(ac: Aircraft) {
  if (ac.emergency === "lifeguard") return <span className="oh-badge">MED</span>;
  if (ac.isMilitary) return <span className="oh-badge">MIL</span>;
  return null;
}
