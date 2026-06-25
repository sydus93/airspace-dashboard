"use client";

import { useAirspace } from "@/store/useAirspace";

// Approx great-circle distance in nautical miles (equirectangular is fine here).
function distNm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (bLat - aLat) * 60;
  const dLon = (bLon - aLon) * 60 * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

// "Search this area" pattern: when the map is panned away from the scan center
// by a meaningful fraction of the radius, offer to re-scan there.
export default function ScanAreaPill() {
  const home = useAirspace((s) => s.home);
  const mapCenter = useAirspace((s) => s.mapCenter);
  const setHome = useAirspace((s) => s.setHome);

  if (!mapCenter) return null;
  const drift = distNm(home.lat, home.lon, mapCenter.lat, mapCenter.lon);
  const threshold = Math.max(8, home.radiusNm * 0.3);
  if (drift < threshold) return null;

  return (
    <button
      className="scan-pill"
      onClick={() => setHome(mapCenter.lat, mapCenter.lon, { label: "Map center" })}
    >
      ⊕ Scan this area
    </button>
  );
}
