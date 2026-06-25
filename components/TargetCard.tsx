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
      <section className="target-card">
        <div className="tc-head">
          <div className="tc-id"><span className="tc-call">{selectedHex.toUpperCase()}</span></div>
          <button className="icon-btn" onClick={() => select(null)} aria-label="close">✕</button>
        </div>
        <div className="tc-lost">Contact lost — out of range or no recent position.</div>
      </section>
    );
  }

  const reason = notableReason(ac);
  const info = enr?.info;
  const route = enr?.route;
  const typeLine =
    info?.typeName || ac.description || ac.typeCode || "Unknown type";
  const owner = info?.owner || ac.ownerOp;
  const photo = info?.photoThumbUrl || info?.photoUrl;

  return (
    <section className="target-card">
      <div className="tc-head">
        <div className="tc-id">
          <span className="tc-call">{aircraftLabel(ac)}</span>
          {ac.registration && ac.registration !== aircraftLabel(ac) && (
            <span className="tc-reg">{ac.registration}</span>
          )}
          {ac.isMilitary && <span className="tc-badge mil">MIL</span>}
          {ac.source !== "adsb" && <span className="tc-badge src">{ac.source.toUpperCase()}</span>}
        </div>
        <div className="tc-head-actions">
          <button
            className={`pill ${follow ? "on" : ""}`}
            onClick={() => setFollow(!follow)}
          >
            {follow ? "Following" : "Follow"}
          </button>
          <button className="icon-btn" onClick={() => select(null)} aria-label="close">✕</button>
        </div>
      </div>

      {reason && <div className="tc-notable">⚠ {reason}</div>}

      <div className="tc-type">{typeLine}</div>

      <div className="tc-grid">
        <Stat label="ALT" value={altitudeText(ac)} color={altitudeColor(ac)} />
        <Stat label="SPD" value={speedText(ac)} />
        <Stat label="VS" value={verticalRateText(ac)} />
        <Stat label="HDG" value={ac.trackDeg !== null ? `${Math.round(ac.trackDeg)}°` : "—"} />
        <Stat label="SQUAWK" value={ac.squawk ?? "—"} />
        <Stat
          label="RANGE"
          value={
            ac.distanceNm !== null
              ? `${ac.distanceNm.toFixed(0)} nm ${bearingText(ac.bearingDeg)}`
              : "—"
          }
        />
      </div>

      {(photo || owner) && (
        <div className="tc-enrich">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="tc-photo" src={photo} alt={typeLine} loading="lazy" />
          )}
          <div className="tc-enrich-text">
            {info?.manufacturer && <div className="tc-mfr">{info.manufacturer}</div>}
            {owner && <div className="tc-owner">{owner}</div>}
            {ac.year && <div className="dim">Built {ac.year}</div>}
            {enr?.infoLoading && !info && <div className="dim">Looking up aircraft…</div>}
          </div>
        </div>
      )}

      <RouteBlock route={route} loading={enr?.routeLoading} />

      <div className="tc-hex">ICAO {ac.hex.toUpperCase()}</div>
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="tc-stat">
      <div className="tc-stat-lbl">{label}</div>
      <div className="tc-stat-val" style={color ? { color } : undefined}>{value}</div>
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
  if (loading && !route) return <div className="tc-route dim">Looking up route…</div>;
  if (!route || (!route.origin && !route.destination)) return null;
  return (
    <div className="tc-route">
      {route.airlineName && <div className="tc-airline">{route.airlineName}</div>}
      <div className="tc-route-line">
        <Airport label={route.origin?.iata || route.origin?.icao} city={route.origin?.municipality} />
        <span className="tc-arrow">→</span>
        <Airport
          label={route.destination?.iata || route.destination?.icao}
          city={route.destination?.municipality}
        />
      </div>
    </div>
  );
}

function Airport({ label, city }: { label?: string; city?: string | null }) {
  return (
    <div className="tc-ap">
      <span className="tc-ap-code">{label ?? "???"}</span>
      {city && <span className="tc-ap-city">{city}</span>}
    </div>
  );
}
