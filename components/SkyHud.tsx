"use client";

import { useMemo } from "react";
import { useAirspace } from "@/store/useAirspace";
import { buildSkyContacts, projectToDome, type SkyContact } from "@/lib/skyGeom";
import { aircraftLabel, altitudeColor, altitudeText, bearingText } from "@/lib/format";
import { identify } from "@/lib/aircraftTypes";

// Sky HUD — Tier 0: the "sky compass." A planetarium-style dome looking straight
// up. Bearing runs around the ring (N at top), elevation runs toward the center
// (horizon at the rim, zenith dead center). Each contact is a dot colored by the
// altitude ramp — the same read as the map. Tap one to see where to look for it.
//
// Read it like a radar scope / compass (top-down, N up). Tier 1 will spin the ring
// to match where the phone is pointed; Tier 2 drops it over the camera.

const R = 86; // dome radius in the 200-unit viewBox
const RINGS = [
  { el: 30, label: "30°" },
  { el: 60, label: "60°" },
];

export default function SkyHud({ open, onClose }: { open: boolean; onClose: () => void }) {
  const home = useAirspace((s) => s.home);
  const frame = useAirspace((s) => s.frame);
  const selectedHex = useAirspace((s) => s.selectedHex);
  const select = useAirspace((s) => s.select);

  const contacts = useMemo(
    () => (frame ? buildSkyContacts({ lat: home.lat, lon: home.lon }, frame.aircraft) : []),
    [frame, home.lat, home.lon]
  );

  if (!open) return null;

  // contacts come back nearest-first; label only the closest few to avoid clutter
  const labeledHexes = new Set(contacts.slice(0, 3).map((c) => c.ac.hex));
  if (selectedHex) labeledHexes.add(selectedHex);

  const selected = contacts.find((c) => c.ac.hex === selectedHex) ?? null;
  const ringR = (el: number) => (1 - el / 90) * R;

  return (
    <div className="sky-hud" role="dialog" aria-label="Sky compass">
      <div className="sky-head">
        <div className="sky-title">
          <span className="panel-kicker">Sky compass</span>
          <span className="sky-sub">looking up · north up · tap a contact</span>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="close sky compass">
          ✕
        </button>
      </div>

      <div className="sky-stage">
        <svg className="sky-dome" viewBox="-100 -100 200 200" aria-hidden>
          {/* rotating scope sweep — ties into the chart's VOR sweep */}
          <g className="sky-sweep">
            <path d={`M 0 0 L 0 ${-R} A ${R} ${R} 0 0 0 ${(-R * 0.5).toFixed(1)} ${(-R * 0.866).toFixed(1)} Z`} />
          </g>

          {/* elevation rings */}
          <circle className="sky-ring rim" cx="0" cy="0" r={R} />
          {RINGS.map((g) => (
            <circle key={g.el} className="sky-ring" cx="0" cy="0" r={ringR(g.el)} />
          ))}
          {/* cardinal + intercardinal spokes */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((az) => {
            const t = (az * Math.PI) / 180;
            return (
              <line
                key={az}
                className={az % 90 === 0 ? "sky-spoke card" : "sky-spoke"}
                x1="0"
                y1="0"
                x2={(R * Math.sin(t)).toFixed(1)}
                y2={(-R * Math.cos(t)).toFixed(1)}
              />
            );
          })}

          {/* elevation ring labels (tucked along the SE diagonal) */}
          {RINGS.map((g) => {
            const r = ringR(g.el);
            return (
              <text key={g.el} className="sky-ring-lbl" x={(r * 0.707).toFixed(1)} y={(r * 0.707).toFixed(1)} dy="-1.5">
                {g.label}
              </text>
            );
          })}

          {/* zenith marker */}
          <circle className="sky-zenith" cx="0" cy="0" r="1.6" />

          {/* contacts */}
          {contacts.map((c) => {
            const p = projectToDome(c.azimuthDeg, c.elevationDeg, R);
            const isSel = c.ac.hex === selectedHex;
            const dr = dotRadius(c);
            return (
              <g key={c.ac.hex} className="sky-contact" onClick={() => select(c.ac.hex)} style={{ cursor: "pointer" }}>
                {/* generous invisible hit target */}
                <circle cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r={Math.max(7, dr + 4)} fill="transparent" />
                {isSel && <circle className="sky-halo" cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r={dr + 4} />}
                <circle
                  className={isSel ? "sky-dot sel" : "sky-dot"}
                  cx={p.x.toFixed(2)}
                  cy={p.y.toFixed(2)}
                  r={dr}
                  style={{ fill: altitudeColor(c.ac) }}
                />
                {labeledHexes.has(c.ac.hex) && (
                  <text className={isSel ? "sky-lbl sel" : "sky-lbl"} x={(p.x + dr + 2).toFixed(2)} y={(p.y + 2).toFixed(2)}>
                    {aircraftLabel(c.ac)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* cardinal letters — HTML so they stay crisp & sized independent of the svg scale */}
        <span className="sky-card n">N</span>
        <span className="sky-card e">E</span>
        <span className="sky-card s">S</span>
        <span className="sky-card w">W</span>
      </div>

      <Readout selected={selected} count={contacts.length} hasSelection={!!selectedHex} />
    </div>
  );
}

function Readout({
  selected,
  count,
  hasSelection,
}: {
  selected: SkyContact | null;
  count: number;
  hasSelection: boolean;
}) {
  if (selected) {
    const ac = selected.ac;
    const id = identify({
      typeCode: ac.typeCode,
      description: ac.description,
      category: ac.category,
      isMilitary: ac.isMilitary,
    });
    const az = Math.round(selected.azimuthDeg);
    const el = Math.round(Math.max(0, selected.elevationDeg));
    return (
      <div className="sky-readout glass no-strip">
        <div className="sky-readout-top">
          <span className="t-class-chip" style={{ color: id.meta.color, borderColor: id.meta.color }}>
            {id.meta.label}
          </span>
          <span className="sky-readout-name">{aircraftLabel(ac)}</span>
          <span className="sky-readout-type">{id.info ? id.name : ac.description || ac.typeCode || ""}</span>
        </div>
        <div className="sky-readout-stats">
          <Look label="Look" value={`${az}° ${bearingText(az)}`} />
          <Look label="Up" value={`${el}°`} />
          <Look label="Line of sight" value={`${selected.slantRangeNm.toFixed(1)} nm`} />
          <Look label="Alt" value={altitudeText(ac)} color={altitudeColor(ac)} />
        </div>
      </div>
    );
  }
  return (
    <div className="sky-readout hint">
      {count > 0
        ? `${count} ${count === 1 ? "contact" : "contacts"} above the horizon — ${
            hasSelection ? "selected contact is below the horizon" : "tap a dot to read its bearing & elevation"
          }`
        : "Nothing above the horizon right now."}
    </div>
  );
}

function Look({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="sky-look">
      <div className="sky-look-lbl">{label}</div>
      <div className="sky-look-val" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

// Nearer contacts read larger — they're the ones you can actually pick out.
function dotRadius(c: SkyContact): number {
  const s = c.slantRangeNm;
  if (s < 5) return 4.4;
  if (s < 15) return 3.6;
  if (s < 40) return 3.0;
  return 2.4;
}
