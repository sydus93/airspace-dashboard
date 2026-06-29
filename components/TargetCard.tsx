"use client";

import { useAirspace } from "@/store/useAirspace";
import {
  aircraftLabel,
  altitudeColor,
  altitudeText,
  bearingText,
  notableReason,
  speedText,
  verticalRateText,
} from "@/lib/format";
import { identify, planespottersUrl, wikipediaUrl } from "@/lib/aircraftTypes";

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

  // selected but no longer in frame (flew out of range / dropped)
  if (!ac) {
    return (
      <section className="target glass">
        <div className="t-head">
          <div className="t-id"><span className="t-call">{selectedHex.toUpperCase()}</span></div>
          <button className="icon-btn" onClick={() => select(null)} aria-label="close">✕</button>
        </div>
        <div className="t-lost">Contact lost — out of range or no recent position.</div>
      </section>
    );
  }

  const reason = notableReason(ac);
  const info = enr?.info;
  const route = enr?.route;
  // Identity / "learn" layer: best human name, spotter class, recognition hint.
  const id = identify({
    typeCode: ac.typeCode,
    description: ac.description,
    category: ac.category,
    isMilitary: ac.isMilitary,
  });
  const typeLine = id.info ? id.name : info?.typeName || id.name;
  const operator = route?.airlineName || info?.owner || ac.ownerOp;
  const sub = operator ? `${typeLine} · ${operator}` : typeLine;
  const owner = info?.owner || ac.ownerOp;
  const photo = info?.photoThumbUrl || info?.photoUrl;

  return (
    <section className="target glass">
      <div className="t-head">
        <div className="t-id">
          <span className="t-call">{aircraftLabel(ac)}</span>
          {ac.registration && ac.registration !== aircraftLabel(ac) && (
            <span className="t-reg">{ac.registration}</span>
          )}
          <div className="t-sub">
            <span
              className="t-class-chip"
              style={{ color: id.meta.color, borderColor: id.meta.color }}
            >
              {id.meta.label}
            </span>
            {sub}
          </div>
        </div>
        <div className="t-head-actions">
          {ac.isMilitary && <span className="tag-badge mil">MIL</span>}
          {ac.source !== "adsb" && <span className="tag-badge src">{ac.source.toUpperCase()}</span>}
          <button className={`pill ${follow ? "on" : ""}`} onClick={() => setFollow(!follow)}>
            {follow ? "Following" : "Follow"}
          </button>
          <button className="icon-btn" onClick={() => select(null)} aria-label="close">✕</button>
        </div>
      </div>

      {reason && <div className="t-notable">{reason}</div>}

      <div className="t-grid">
        <Stat label="Alt" value={altitudeText(ac)} color={altitudeColor(ac)} />
        <Stat label="Speed" value={speedText(ac)} />
        <Stat label="V / S" value={verticalRateText(ac)} />
      </div>

      <div className="t-meta">
        <Meta label="Hdg" value={ac.trackDeg !== null ? `${Math.round(ac.trackDeg)}°` : "—"} />
        <Meta label="Squawk" value={ac.squawk ?? "—"} />
        <Meta
          label="Range"
          value={
            ac.distanceNm !== null
              ? `${ac.distanceNm.toFixed(0)} nm ${bearingText(ac.bearingDeg)}`
              : "—"
          }
        />
      </div>

      {(photo || owner) && (
        <div className="t-enrich">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="t-photo" src={photo} alt={typeLine} loading="lazy" />
          )}
          <div className="t-enrich-text">
            {info?.manufacturer && <div className="t-mfr">{info.manufacturer}</div>}
            {owner && <div className="t-owner">{owner}</div>}
            {ac.year && <div className="t-dim">Built {ac.year}</div>}
            {enr?.infoLoading && !info && <div className="t-dim">Looking up aircraft…</div>}
          </div>
        </div>
      )}

      <RouteBlock route={route} loading={enr?.routeLoading} />

      <div className="t-learn">
        <div className="t-learn-recog">{id.recog || id.meta.blurb}</div>
        <div className="t-learn-links">
          <a
            className="t-learn-link"
            href={planespottersUrl(ac.registration, ac.hex)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Photos ↗
          </a>
          <a
            className="t-learn-link"
            href={wikipediaUrl(id.info, id.name)}
            target="_blank"
            rel="noopener noreferrer"
          >
            About this type ↗
          </a>
        </div>
      </div>

      <div className="t-hex">ICAO {ac.hex.toUpperCase()}</div>
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="t-stat-lbl">{label}</div>
      <div className="t-stat-val" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="t-meta-item">
      <div className="t-meta-lbl">{label}</div>
      <div className="t-meta-val">{value}</div>
    </div>
  );
}

function RouteBlock({
  route,
  loading,
}: {
  route: import("@/lib/types").FlightRoute | null | undefined;
  loading: boolean | undefined;
}) {
  if (loading && !route) return <div className="t-airline">Looking up route…</div>;
  if (!route || (!route.origin && !route.destination)) return null;
  return (
    <div className="t-route">
      <Airport label={route.origin?.iata || route.origin?.icao} city={route.origin?.municipality} />
      <div className="t-route-dash" />
      <span className="t-route-arrow">→</span>
      <div className="t-route-dash" />
      <Airport
        label={route.destination?.iata || route.destination?.icao}
        city={route.destination?.municipality}
      />
    </div>
  );
}

function Airport({ label, city }: { label?: string; city?: string | null }) {
  return (
    <div className="t-ap">
      <div className="t-ap-code">{label ?? "???"}</div>
      {city && <div className="t-ap-city">{city}</div>}
    </div>
  );
}
