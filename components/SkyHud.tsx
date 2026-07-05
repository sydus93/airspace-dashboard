"use client";

import { useMemo } from "react";
import { useAirspace } from "@/store/useAirspace";
import { buildSkyContacts, projectToDome, angleDiff, type SkyContact } from "@/lib/skyGeom";
import { aircraftLabel, altitudeColor, altitudeText, bearingText } from "@/lib/format";
import { identify } from "@/lib/aircraftTypes";
import { useSkyOrientation } from "@/lib/useSkyOrientation";
import { config } from "@/lib/config";

// Sky HUD — the "sky compass."
//
// Tier 0 (no sensors): a planetarium dome looking straight up. Bearing runs around
// the ring (N at top), elevation toward the center (horizon at the rim, zenith dead
// center). Tap a contact to read where to look.
//
// Tier 1 (point your phone): with the device compass enabled, the whole dome spins
// so the way you're *facing* is at the top, a reticle marks your aim, and whatever
// you point at is read out live — sweep the phone around the sky and the planes
// announce themselves. The rotation is folded into the projection (we subtract your
// heading from every bearing) so all the labels stay upright.

const R = 86; // dome radius in the 200-unit viewBox
const RINGS = [
  { el: 30, label: "30°" },
  { el: 60, label: "60°" },
];
const CARDINALS = [
  { az: 0, label: "N" },
  { az: 90, label: "E" },
  { az: 180, label: "S" },
  { az: 270, label: "W" },
];
const AIM_AZ_WINDOW = 22; // deg: how close in bearing a contact must be to count as "aimed at"

export default function SkyHud({ open, onClose }: { open: boolean; onClose: () => void }) {
  const home = useAirspace((s) => s.home);
  const frame = useAirspace((s) => s.frame);
  const selectedHex = useAirspace((s) => s.selectedHex);
  const select = useAirspace((s) => s.select);
  const headingOffset = useAirspace((s) => s.skyHeadingOffset);
  const nudgeOffset = useAirspace((s) => s.nudgeSkyHeadingOffset);
  const resetOffset = useAirspace((s) => s.resetSkyHeadingOffset);

  const { permission, heading, pitch, accuracyDeg, enable } = useSkyOrientation({
    active: open,
    declinationDeg: config.magneticDeclinationDeg,
  });

  const contacts = useMemo(
    () => (frame ? buildSkyContacts({ lat: home.lat, lon: home.lon }, frame.aircraft) : []),
    [frame, home.lat, home.lon]
  );

  // Heading you're actually facing, with the manual fine-tune applied.
  const compassOn = permission === "granted" && heading !== null;
  const facing = compassOn ? (heading! + headingOffset + 360) % 360 : 0;
  const rot = compassOn ? facing : 0; // bearing→screen offset (Tier 0 = 0, i.e. N up)

  // The contact you're pointing at: nearest in bearing (and, if we have tilt, in
  // elevation too) to where the phone aims.
  const aimed = useMemo<SkyContact | null>(() => {
    if (!compassOn) return null;
    let best: SkyContact | null = null;
    let bestScore = Infinity;
    for (const c of contacts) {
      const dAz = Math.abs(angleDiff(c.azimuthDeg, facing));
      if (dAz > AIM_AZ_WINDOW) continue;
      const dEl = pitch !== null ? Math.abs(c.elevationDeg - pitch) : 0;
      const score = dAz + 0.6 * dEl;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }, [compassOn, contacts, facing, pitch]);

  if (!open) return null;

  // contacts come back nearest-first; label the closest few + anything highlighted
  const labeled = new Set(contacts.slice(0, 3).map((c) => c.ac.hex));
  if (selectedHex) labeled.add(selectedHex);
  if (aimed) labeled.add(aimed.ac.hex);

  // Readout follows a pinned tap selection if there is one, else your live aim.
  const selected = contacts.find((c) => c.ac.hex === selectedHex) ?? null;
  const readoutContact = selected ?? aimed;
  const readoutIsAim = !selected && !!aimed;

  const ringR = (el: number) => (1 - el / 90) * R;
  const reticleR = pitch !== null ? ringR(Math.max(0, Math.min(90, pitch))) : R * 0.62;

  const offsetLabel = headingOffset > 180 ? headingOffset - 360 : headingOffset;

  return (
    <div className="sky-hud" role="dialog" aria-label="Sky compass">
      <div className="sky-head">
        <div className="sky-title">
          <span className="sky-kicker">SKY COMPASS</span>
          <span className="sky-sub">{subtitle(permission, compassOn, facing)}</span>
        </div>
        <div className="sky-head-actions">
          {compassOn && (
            <div className="sky-cal" role="group" aria-label="align compass">
              <button onClick={() => nudgeOffset(-2)} aria-label="rotate compass left">⟲</button>
              <button
                className="sky-cal-val"
                onClick={resetOffset}
                title="Tap to reset alignment"
              >
                {offsetLabel === 0 ? "align" : `${offsetLabel > 0 ? "+" : ""}${offsetLabel}°`}
              </button>
              <button onClick={() => nudgeOffset(2)} aria-label="rotate compass right">⟳</button>
            </div>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="close sky compass">✕</button>
        </div>
      </div>

      <div className="sky-stage">
        <svg className="sky-dome" viewBox="-100 -100 200 200" aria-hidden>
          {/* rotating scope sweep — only in static (Tier 0) mode */}
          {!compassOn && (
            <g className="sky-sweep">
              <path d={`M 0 0 L 0 ${-R} A ${R} ${R} 0 0 0 ${(-R * 0.5).toFixed(1)} ${(-R * 0.866).toFixed(1)} Z`} />
            </g>
          )}

          {/* elevation rings (fixed) */}
          <circle className="sky-ring rim" cx="0" cy="0" r={R} />
          {RINGS.map((g) => (
            <circle key={g.el} className="sky-ring" cx="0" cy="0" r={ringR(g.el)} />
          ))}

          {/* spokes — every intercardinal, rotated with the dome */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((az) => {
            const t = ((az - rot) * Math.PI) / 180;
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

          {/* elevation ring labels (fixed, upright) */}
          {RINGS.map((g) => {
            const r = ringR(g.el);
            return (
              <text key={g.el} className="sky-ring-lbl" x={(r * 0.707).toFixed(1)} y={(r * 0.707).toFixed(1)} dy="-1.5">
                {g.label}
              </text>
            );
          })}

          {/* cardinal letters — positioned by heading, kept upright */}
          {CARDINALS.map((c) => {
            const t = ((c.az - rot) * Math.PI) / 180;
            const rr = R + 8;
            return (
              <text
                key={c.label}
                className={`sky-card-svg${c.label === "N" ? " n" : ""}`}
                x={(rr * Math.sin(t)).toFixed(1)}
                y={(-rr * Math.cos(t)).toFixed(1)}
              >
                {c.label}
              </text>
            );
          })}

          {/* aim guide + reticle (Tier 1) */}
          {compassOn && (
            <>
              <line className="sky-look-line" x1="0" y1="0" x2="0" y2={-R} />
              <g className="sky-reticle" transform={`translate(0 ${(-reticleR).toFixed(1)})`}>
                <circle cx="0" cy="0" r="5" />
                <line x1="-7" y1="0" x2="-3" y2="0" />
                <line x1="3" y1="0" x2="7" y2="0" />
                <line x1="0" y1="-7" x2="0" y2="-3" />
                <line x1="0" y1="3" x2="0" y2="7" />
              </g>
            </>
          )}

          {/* zenith marker (fixed) */}
          <circle className="sky-zenith" cx="0" cy="0" r="1.6" />

          {/* contacts */}
          {contacts.map((c) => {
            const p = projectToDome(c.azimuthDeg - rot, c.elevationDeg, R);
            const isSel = c.ac.hex === selectedHex;
            const isAim = aimed?.ac.hex === c.ac.hex && !isSel;
            const dr = dotRadius(c);
            return (
              <g key={c.ac.hex} className="sky-contact" onClick={() => select(c.ac.hex)} style={{ cursor: "pointer" }}>
                <circle cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r={Math.max(7, dr + 4)} fill="transparent" />
                {isSel && <circle className="sky-halo" cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r={dr + 4} />}
                {isAim && <circle className="sky-aim-ring" cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r={dr + 3.5} />}
                <circle
                  className={isSel ? "sky-dot sel" : "sky-dot"}
                  cx={p.x.toFixed(2)}
                  cy={p.y.toFixed(2)}
                  r={dr}
                  style={{ fill: altitudeColor(c.ac) }}
                />
                {labeled.has(c.ac.hex) && (
                  <text
                    className={`sky-lbl${isSel ? " sel" : ""}${isAim ? " aim" : ""}`}
                    x={(p.x + dr + 2).toFixed(2)}
                    y={(p.y + 2).toFixed(2)}
                  >
                    {aircraftLabel(c.ac)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* enable / status overlay */}
        {permission === "prompt" && (
          <button className="sky-enable" onClick={enable}>
            Point your phone at the sky →
          </button>
        )}
        {permission === "denied" && (
          <div className="sky-note">Compass blocked — enable Motion &amp; Orientation Access in Settings ▸ Safari.</div>
        )}
        {permission === "insecure" && (
          <div className="sky-note">Open the installed app (https) to point at the sky — north-up works here.</div>
        )}
        {compassOn && accuracyDeg !== null && (accuracyDeg < 0 || accuracyDeg > 25) && (
          <div className="sky-note warn">Wave the phone in a figure-8 to calibrate the compass.</div>
        )}
      </div>

      <Readout contact={readoutContact} isAim={readoutIsAim} count={contacts.length} compassOn={compassOn} />
    </div>
  );
}

function subtitle(permission: string, compassOn: boolean, facing: number): string {
  if (compassOn) return `facing ${Math.round(facing)}° ${bearingText(facing)} · move your phone to aim`;
  if (permission === "granted") return "reading compass…";
  if (permission === "unsupported") return "looking up · north up · tap a contact";
  return "north up · tap a contact";
}

function Readout({
  contact,
  isAim,
  count,
  compassOn,
}: {
  contact: SkyContact | null;
  isAim: boolean;
  count: number;
  compassOn: boolean;
}) {
  if (contact) {
    const ac = contact.ac;
    const id = identify({
      typeCode: ac.typeCode,
      description: ac.description,
      category: ac.category,
      isMilitary: ac.isMilitary,
    });
    const az = Math.round(contact.azimuthDeg);
    const el = Math.round(Math.max(0, contact.elevationDeg));
    return (
      <div className="sky-readout">
        <div className="sky-readout-top">
          {isAim && <span className="sky-aim-tag">⌖ aiming</span>}
          <span className="t-class-chip">{id.meta.label}</span>
          <span className="sky-readout-name">{aircraftLabel(ac)}</span>
          <span className="sky-readout-type">{id.info ? id.name : ac.description || ac.typeCode || ""}</span>
        </div>
        <div className="sky-readout-stats">
          <Look label="Look" value={`${az}° ${bearingText(az)}`} />
          <Look label="Up" value={`${el}°`} />
          <Look label="Line of sight" value={`${contact.slantRangeNm.toFixed(1)} nm`} />
          <Look label="Alt" value={altitudeText(ac)} color={altitudeColor(ac)} />
        </div>
      </div>
    );
  }
  return (
    <div className="sky-readout hint">
      {count > 0
        ? compassOn
          ? `${count} ${count === 1 ? "contact" : "contacts"} up — sweep your phone across the sky`
          : `${count} ${count === 1 ? "contact" : "contacts"} above the horizon — tap a dot to read its bearing & elevation`
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
