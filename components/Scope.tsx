"use client";

import { useMemo } from "react";
import { useAirspace } from "@/store/useAirspace";
import { markerColor, isNotable, aircraftLabel } from "@/lib/format";
import type { Aircraft } from "@/lib/types";

// RADAR scope — the instrument's primary view. A polar plot centered on the scan
// home: bearing runs around the ring (N up), range runs from the center out to the
// scan radius at the rim. Blips are altitude-tinted triangles pointing along track.
// This is the abstract counterpart to the geographic SECTIONAL (Leaflet) view.

const R = 86; // scope radius in the 200-unit viewBox
const RINGS = [1 / 3, 2 / 3, 1]; // fractions of radius for the range rings
const CARDINALS = [
  { az: 0, label: "N" },
  { az: 90, label: "E" },
  { az: 180, label: "S" },
  { az: 270, label: "W" },
];

interface Blip {
  hex: string;
  x: number;
  y: number;
  tri: string;
  rot: string;
  color: string;
  sel: boolean;
  notable: boolean;
  showLabel: boolean;
  call: string;
}

function triPath(sz: number): string {
  return `M0 ${-sz} L ${(sz * 0.66).toFixed(2)} ${(sz * 0.8).toFixed(2)} L 0 ${(sz * 0.4).toFixed(
    2
  )} L ${(-sz * 0.66).toFixed(2)} ${(sz * 0.8).toFixed(2)} Z`;
}

export default function Scope() {
  const frame = useAirspace((s) => s.frame);
  const home = useAirspace((s) => s.home);
  const selectedHex = useAirspace((s) => s.selectedHex);
  const select = useAirspace((s) => s.select);

  const radiusNm = home.radiusNm || 60;

  const blips = useMemo<Blip[]>(() => {
    const list = frame?.aircraft ?? [];
    const out: Array<Blip & { dist: number }> = [];
    for (const a of list) {
      if (a.distanceNm === null || a.bearingDeg === null) continue;
      const frac = Math.min(1, a.distanceNm / radiusNm);
      const r = frac * R;
      const t = (a.bearingDeg * Math.PI) / 180;
      const x = r * Math.sin(t);
      const y = -r * Math.cos(t);
      const sel = a.hex === selectedHex;
      const cls = a.category;
      const sz = cls && /A5|A6/.test(cls) ? 5 : isNotable(a) ? 4.6 : 4;
      out.push({
        hex: a.hex,
        x: +x.toFixed(2),
        y: +y.toFixed(2),
        tri: triPath(sz),
        rot: `rotate(${Math.round(a.trackDeg ?? 0)})`,
        color: markerColor(a, sel),
        sel,
        notable: isNotable(a),
        showLabel: false,
        call: aircraftLabel(a),
        dist: a.distanceNm,
      });
    }
    out.sort((p, q) => p.dist - q.dist);
    out.forEach((b, i) => {
      b.showLabel = i < 3 || b.sel || b.notable;
    });
    return out;
  }, [frame, radiusNm, selectedHex]);

  return (
    <div className="scope-overlay">
      <svg className="scope-svg" viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid meet">
        {/* deselect on background tap */}
        <rect
          x="-100"
          y="-100"
          width="200"
          height="200"
          fill="transparent"
          onClick={() => select(null)}
        />

        {/* sweep */}
        <g className="scope-sweep">
          <line x1="0" y1="0" x2="0" y2={-R} />
        </g>

        {/* fine bearing ticks around the rim */}
        <circle className="scope-ring ticks" cx="0" cy="0" r={R} strokeDasharray="1 8.5" />

        {/* range rings */}
        {RINGS.map((f, i) => (
          <circle
            key={i}
            className={`scope-ring${f === 1 ? " rim" : ""}`}
            cx="0"
            cy="0"
            r={(R * f).toFixed(1)}
          />
        ))}

        {/* cross spokes */}
        <line className="scope-spoke" x1="0" y1={-R} x2="0" y2={R} />
        <line className="scope-spoke" x1={-R} y1="0" x2={R} y2="0" />

        {/* range labels along the top spoke */}
        {RINGS.map((f, i) => (
          <text key={i} className="scope-ring-lbl" x="2" y={(-R * f).toFixed(1)} dy="-1.5">
            {i === RINGS.length - 1 ? `${Math.round(radiusNm)} nm` : `${Math.round(radiusNm * f)}`}
          </text>
        ))}

        {/* cardinals */}
        {CARDINALS.map((c) => {
          const t = (c.az * Math.PI) / 180;
          const rr = R + 8;
          return (
            <text
              key={c.label}
              className={`scope-card${c.label === "N" ? " n" : ""}`}
              x={(rr * Math.sin(t)).toFixed(1)}
              y={(-rr * Math.cos(t)).toFixed(1)}
              dominantBaseline="middle"
            >
              {c.label}
            </text>
          );
        })}

        {/* observer diamond at center */}
        <path className="scope-center" d="M-4 0 L0 -4 L4 0 L0 4 Z" />

        {/* blips */}
        {blips.map((b) => {
          const sz = b.notable ? 6.6 : 6;
          return (
            <g
              key={b.hex}
              onClick={() => select(b.hex)}
              style={{ cursor: "pointer" }}
              transform={`translate(${b.x} ${b.y})`}
            >
              <circle cx="0" cy="0" r="7" fill="transparent" />
              {(b.sel || b.notable) && (
                <rect
                  className={`scope-blip-box${b.notable && !b.sel ? " notable" : ""}`}
                  x={-sz / 2}
                  y={-sz / 2}
                  width={sz}
                  height={sz}
                />
              )}
              <path d={b.tri} fill={b.color} transform={b.rot} />
              {b.showLabel && (
                <text className={`scope-lbl${b.sel ? " sel" : ""}`} x="5" y="2">
                  {b.call}
                </text>
              )}
            </g>
          );
        })}

        {blips.length === 0 && (
          <text className="scope-empty" x="0" y="0" dominantBaseline="middle">
            NO CONTACTS IN RANGE
          </text>
        )}
      </svg>
    </div>
  );
}
