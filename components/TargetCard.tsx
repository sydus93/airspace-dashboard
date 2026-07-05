"use client";

import { useAirspace } from "@/store/useAirspace";
import {
  aircraftLabel,
  altitudeColor,
  altitudeText,
  bearingText,
  isNotable,
  notableReason,
  speedText,
  verticalRateText,
} from "@/lib/format";
import { identify, planespottersUrl, wikipediaUrl } from "@/lib/aircraftTypes";
import type { FlightRoute } from "@/lib/types";

export default function TargetCard() {
  const selectedHex = useAirspace((s) => s.selectedHex);
  const ac = useAirspace((s) =>
    selectedHex ? s.frame?.aircraft.find((a) => a.hex === selectedHex) ?? null : null
  );
  const enr = useAirspace((s) => (selectedHex ? s.enrichments[selectedHex] : undefined));
  const follow = useAirspace((s) => s.followSelected);
  const select = useAirspace((s) => s.select);
  const setFollow = useAirspace((s) => s.setFollow);

  if (!selectedHex) return null;

  if (!ac) {
    return (
      <section className="target">
        <div className="t-hazard" />
        <div className="t-head" style={{ padding: "11px 12px" }}>
          <span className="t-call">{selectedHex.toUpperCase()}</span>
          <button className="icon-btn" onClick={() => select(null)} aria-label="close">
            ✕
          </button>
        </div>
        <div className="t-lost">Contact lost — out of range or no recent position.</div>
      </section>
    );
  }

  const notable = isNotable(ac);
  const reason = notableReason(ac);
  const info = enr?.info;
  const route = enr?.route;
  const id = identify({
    typeCode: ac.typeCode,
    description: ac.description,
    category: ac.category,
    isMilitary: ac.isMilitary,
  });
  const typeName = id.info ? id.name : info?.typeName || id.name;
  const operator = route?.airlineName || info?.owner || ac.ownerOp;
  const sub = operator ? `${typeName} · ${operator}` : typeName;
  const owner = info?.owner || ac.ownerOp;
  const photo = info?.photoThumbUrl || info?.photoUrl;
  const altPct = `${Math.round(Math.min(1, (ac.altBaroFt ?? 0) / 42000) * 100)}%`;

  return (
    <section className="target">
      <div className={`t-hazard ${notable ? "notable" : ""}`} />
      <div className="t-body">
        <div className="t-head">
          <div className="t-id">
            <div className="t-id-top">
              <span className="t-call">{aircraftLabel(ac)}</span>
              {ac.registration && ac.registration !== aircraftLabel(ac) && (
                <span className="t-reg">{ac.registration}</span>
              )}
            </div>
            <div className="t-sub">
              <span className="t-class-chip">{id.meta.label}</span>
              <span className="t-sub-txt">{sub}</span>
            </div>
          </div>
          <div className="t-head-actions">
            {ac.isMilitary && <span className="tag-badge">MIL</span>}
            {ac.source !== "adsb" && <span className="tag-badge">{ac.source.toUpperCase()}</span>}
            <button className={`pill ${follow ? "on" : ""}`} onClick={() => setFollow(!follow)}>
              {follow ? "Following" : "Follow"}
            </button>
            <button className="icon-btn" onClick={() => select(null)} aria-label="close">
              ✕
            </button>
          </div>
        </div>

        {reason && <div className="t-notable">▲ {reason}</div>}

        <div className="t-altbar-wrap">
          <div className="t-altbar-scale">
            <span>Altitude · 0</span>
            <span>FL420</span>
          </div>
          <div className="t-altbar">
            <div className="t-altbar-fill" style={{ width: altPct }} />
            <div className="t-altbar-tick" style={{ left: altPct }} />
          </div>
        </div>

        <div className="t-grid">
          <Stat label="Alt" value={altitudeText(ac).replace(" ft", "")} color={altitudeColor(ac)} />
          <Stat label="Speed" value={speedText(ac).replace(" kt", "")} />
          <Stat label="V / S" value={verticalRateText(ac)} />
        </div>

        <div className="t-meta">
          <span>
            <span className="t-meta-lbl">Hdg</span>
            <span className="t-meta-val">
              {ac.trackDeg !== null ? `${Math.round(ac.trackDeg)}°` : "—"}
            </span>
          </span>
          <span>
            <span className="t-meta-lbl">Sqk</span>
            <span className="t-meta-val">{ac.squawk ?? "—"}</span>
          </span>
          <span>
            <span className="t-meta-lbl">Rng</span>
            <span className="t-meta-val">
              {ac.distanceNm !== null
                ? `${ac.distanceNm.toFixed(0)}nm ${bearingText(ac.bearingDeg)}`
                : "—"}
            </span>
          </span>
        </div>

        {(photo || owner || ac.year) && (
          <div className="t-enrich">
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="t-photo" src={photo} alt={typeName} loading="lazy" />
            )}
            <div className="t-enrich-text">
              {info?.manufacturer && <div className="t-mfr">{info.manufacturer}</div>}
              {owner && <div>{owner}</div>}
              {ac.year && <div className="t-dim">Built {ac.year}</div>}
              {enr?.infoLoading && !info && <div className="t-dim">Looking up aircraft…</div>}
            </div>
          </div>
        )}

        <RouteBlock route={route} loading={enr?.routeLoading} />

        <div className="t-learn">
          <div className="t-recog">
            <span className="t-recog-type">{typeName}</span> · {id.recog || id.meta.blurb}
          </div>
        </div>

        <div className="t-links">
          <div className="t-links-l">
            <a className="t-link" href={planespottersUrl(ac.registration, ac.hex)} target="_blank" rel="noopener noreferrer">
              PHOTOS ↗
            </a>
            <a className="t-link" href={wikipediaUrl(id.info, id.name)} target="_blank" rel="noopener noreferrer">
              TYPE ↗
            </a>
          </div>
          <span className="t-hex">ICAO {ac.hex.toUpperCase()}</span>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="t-stat">
      <div className="t-stat-lbl">{label}</div>
      <div className="t-stat-val" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function RouteBlock({
  route,
  loading,
}: {
  route: FlightRoute | null | undefined;
  loading: boolean | undefined;
}) {
  if (loading && !route) return null;
  if (!route || (!route.origin && !route.destination)) return null;
  return (
    <div className="t-route">
      <div className="t-ap">
        <div className="t-ap-code">{route.origin?.iata || route.origin?.icao || "???"}</div>
        {route.origin?.municipality && <div className="t-ap-city">{route.origin.municipality}</div>}
      </div>
      <div className="t-route-mid">
        <span className="t-route-dash" />
        <span className="t-route-arrow">→</span>
        <span className="t-route-dash" />
      </div>
      <div className="t-ap dest">
        <div className="t-ap-code">{route.destination?.iata || route.destination?.icao || "???"}</div>
        {route.destination?.municipality && (
          <div className="t-ap-city">{route.destination.municipality}</div>
        )}
      </div>
    </div>
  );
}
