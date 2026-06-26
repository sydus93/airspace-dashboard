import { NextRequest, NextResponse } from "next/server";
import { fetchAirportLayout } from "@/lib/sources/airport";
import { SingleFlight } from "@/lib/rateLimit";
import type { ApiEnvelope, AirportLayout } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One single-flight per rounded bbox: panning around an airport reuses the same
// cached layout, and Overpass is hit at most once per ~8s per area.
const flights = new Map<string, SingleFlight<AirportLayout>>();
const MAX_KEYS = 80;

function flightFor(key: string): SingleFlight<AirportLayout> {
  let f = flights.get(key);
  if (!f) {
    f = new SingleFlight(8_000, 60_000);
    flights.set(key, f);
  }
  return f;
}

function parseBbox(s: string | null): [number, number, number, number] | null {
  if (!s) return null;
  const p = s.split(",").map(Number);
  if (p.length !== 4 || p.some((x) => !Number.isFinite(x))) return null;
  let [south, west, north, east] = p;
  if (south > north) [south, north] = [north, south];
  if (west > east) [west, east] = [east, west];
  // airport-scale only — keeps Overpass queries cheap and relevant
  if (north - south > 0.4 || east - west > 0.4) return null;
  return [south, west, north, east];
}

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get("bbox"));
  if (!bbox) {
    return NextResponse.json(
      {
        ok: false,
        data: { features: [], bbox: [0, 0, 0, 0] },
        stale: false,
        fetchedAt: 0,
        error: "missing/invalid bbox or area too large",
      } as ApiEnvelope<AirportLayout>,
      { status: 400 }
    );
  }

  // ~0.02° grid so nearby pans collapse onto one cache key
  const key = bbox.map((x) => x.toFixed(2)).join(",");
  if (flights.size > MAX_KEYS) flights.clear();

  const cached = await flightFor(key).get(() => fetchAirportLayout(bbox), 10 * 60_000);

  const body: ApiEnvelope<AirportLayout> = {
    ok: cached.value !== null,
    data: cached.value ?? { features: [], bbox },
    stale: cached.stale,
    fetchedAt: cached.fetchedAt,
    error: cached.error,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status: cached.value === null && cached.error ? 503 : 200,
  });
}
