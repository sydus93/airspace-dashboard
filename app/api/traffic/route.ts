import { NextRequest, NextResponse } from "next/server";
import { fetchTraffic } from "@/lib/sources/traffic";
import { SingleFlight } from "@/lib/rateLimit";
import { config } from "@/lib/config";
import type { Aircraft, ApiEnvelope, TrafficFrame } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One single-flight per (lat,lon,radius) key so multiple tabs/clients never
// push airplanes.live past 1 req/sec. Keyed map persists for the server's life.
const flights = new Map<string, SingleFlight<{ aircraft: Aircraft[]; total: number }>>();

function flightFor(key: string): SingleFlight<{ aircraft: Aircraft[]; total: number }> {
  let f = flights.get(key);
  if (!f) {
    f = new SingleFlight(1000); // >= 1000ms upstream spacing
    flights.set(key, f);
  }
  return f;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat") ?? config.home.lat);
  const lon = Number(sp.get("lon") ?? config.home.lon);
  const radius = Number(sp.get("radius") ?? config.home.radiusNm);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radius)) {
    return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });
  }

  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${Math.round(radius)}`;
  const flight = flightFor(key);

  // Frame is stale once it's older than 3 missed cycles (~3s).
  const cached = await flight.get(() => fetchTraffic(lat, lon, radius), 3000);

  let aircraft = cached.value?.aircraft ?? [];
  const total = cached.value?.total ?? aircraft.length;
  if (aircraft.length > config.maxAircraft) {
    // keep the closest N (dst already computed upstream)
    aircraft = [...aircraft]
      .sort((a, b) => (a.distanceNm ?? 1e9) - (b.distanceNm ?? 1e9))
      .slice(0, config.maxAircraft);
  }

  const frame: TrafficFrame = {
    aircraft,
    fetchedAt: cached.fetchedAt,
    stale: cached.stale,
    total,
  };

  const body: ApiEnvelope<TrafficFrame> = {
    ok: cached.value !== null,
    data: frame,
    stale: cached.stale,
    fetchedAt: cached.fetchedAt,
    error: cached.error,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status: cached.value === null && cached.error ? 503 : 200,
  });
}
