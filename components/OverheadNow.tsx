"use client";

import { useAirspace } from "@/store/useAirspace";
import {
  aircraftLabel,
  altitudeColor,
  altitudeText,
  bearingText,
} from "@/lib/format";
import type { Aircraft } from "@/lib/types";
import { identify } from "@/lib/aircraftTypes";
import PlaneGlyph from "@/components/PlaneGlyph";

// "Overhead now" — the floating glass rail (top-right, desktop). Closest traffic
// first: a featured nearest contact, then the next few by range. Reads straight
// off the live frame; tapping a row selects it on the chart.
export default function OverheadNow() {
  const frame = useAirspace((s) => s.frame);
  const select = useAirspace((s) => s.select);

  const byRange = (frame?.aircraft ?? [])
    .filter((a) => a.distanceNm !== null)
    .sort((a, b) => (a.distanceNm ?? 1e9) - (b.distanceNm ?? 1e9));

  const featured = byRange[0] ?? null;
  const rows = byRange.slice(1, 4);

  return (
    <aside className="overhead glass">
      <div className="panel-eyebrow">
        <span className="panel-kicker">Overhead now</span>
        <span className="panel-aside">by range</span>
      </div>

      {featured ? (
        <button
          className="overhead-featured"
          onClick={() => select(featured.hex)}
          style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          <div className="nearest">
            Nearest{featured.distanceNm !== null ? ` · ${featured.distanceNm.toFixed(1)} nm` : ""}
          </div>
          <div className="row">
            <span className="call">{aircraftLabel(featured)}</span>
            <span className="alt" style={{ color: altitudeColor(featured) }}>
              {altDisplay(featured)}
            </span>
          </div>
          <div className="type">{typeLine(featured)}</div>
        </button>
      ) : (
        <div className="overhead-empty">No traffic in range right now.</div>
      )}

      {rows.map((ac) => (
        <button
          key={ac.hex}
          className="contact-row"
          onClick={() => select(ac.hex)}
          style={{ width: "100%", background: "none", border: "none", borderBottom: "0.5px solid rgba(244,236,216,0.07)", cursor: "pointer" }}
        >
          <span className="contact-glyph">
            <PlaneGlyph ac={ac} />
          </span>
          <span className="contact-mid">
            <span className="contact-name">
              {aircraftLabel(ac)}
              {badge(ac)}
            </span>
            <span className="contact-sub">{typeLine(ac)}</span>
          </span>
          <span className="contact-end">
            <span className="contact-alt" style={{ color: altitudeColor(ac) }}>
              {altitudeText(ac).replace(" ft", "")}
            </span>
            <span className="contact-range">
              {ac.distanceNm !== null ? `${ac.distanceNm.toFixed(0)} nm ${bearingText(ac.bearingDeg)}` : ""}
            </span>
          </span>
        </button>
      ))}
    </aside>
  );
}

function altDisplay(ac: Aircraft): string {
  const base = altitudeText(ac).replace(" ft", "");
  if (ac.onGround) return base;
  if (ac.verticalRateFpm !== null && ac.verticalRateFpm > 100) return `${base} ↑`;
  if (ac.verticalRateFpm !== null && ac.verticalRateFpm < -100) return `${base} ↓`;
  return base;
}

function typeLine(ac: Aircraft): string {
  const id = identify({
    typeCode: ac.typeCode,
    description: ac.description,
    category: ac.category,
    isMilitary: ac.isMilitary,
  });
  // Prefer the curated friendly name; fall back to the feed's raw description.
  return id.info ? id.name : ac.description || ac.typeCode || "Unknown type";
}

function badge(ac: Aircraft) {
  if (ac.emergency === "lifeguard") return <span className="tag-badge med">MED</span>;
  if (ac.isMilitary) return <span className="tag-badge mil">MIL</span>;
  return null;
}
