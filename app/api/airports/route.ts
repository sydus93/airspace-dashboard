import { NextRequest, NextResponse } from "next/server";
import rawAirports from "@/lib/data/airports.json";

export const runtime = "nodejs";
// Static dataset — safe to cache hard at the edge.
export const revalidate = 86400;

// Airport index for map symbology: "where are the fields worth zooming into?"
//
// Source: OurAirports (public domain), filtered to US/CA/MX at large/medium/small
// and baked into lib/data/airports.json at build time. It's a static asset, so
// there is no upstream to rate-limit, key, or fail — matching the offline
// aircraft-type dictionary pattern in lib/aircraftTypes.ts.
//
// Row shape (compact on purpose — ~19k rows): [ident, name, lat, lon, rank, iata]
// rank: 0 = large_airport, 1 = medium_airport, 2 = small_airport

type Row = [string, string, number, number, number, string];
const AIRPORTS = rawAirports as Row[];

export interface AirportMarker {
  ident: string;
  name: string;
  lat: number;
  lon: number;
  rank: number;
  iata: string | null;
}

// Progressive disclosure, the way a sectional declutters: majors first, then
// regionals, then the little fields once you're actually close enough to land.
function maxRankForZoom(z: number): number {
  if (z < 7) return 0;
  if (z < 9) return 1;
  return 2;
}

// Bound the response so a wide viewport can't return thousands of pins.
const MAX_RESULTS = 500;

function parseBbox(s: string | null): [number, number, number, number] | null {
  if (!s) return null;
  const p = s.split(",").map(Number);
  if (p.length !== 4 || p.some((x) => !Number.isFinite(x))) return null;
  let [south, west, north, east] = p;
  if (south > north) [south, north] = [north, south];
  if (west > east) [west, east] = [east, west];
  return [south, west, north, east];
}

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get("bbox"));
  if (!bbox) {
    return NextResponse.json({ ok: false, error: "bbox required" }, { status: 400 });
  }
  const z = Number(req.nextUrl.searchParams.get("z"));
  const maxRank = maxRankForZoom(Number.isFinite(z) ? z : 8);
  const [south, west, north, east] = bbox;

  const hits: AirportMarker[] = [];
  for (const [ident, name, lat, lon, rank, iata] of AIRPORTS) {
    if (rank > maxRank) continue;
    if (lat < south || lat > north || lon < west || lon > east) continue;
    hits.push({ ident, name, lat, lon, rank, iata: iata || null });
  }
  // AIRPORTS is pre-sorted by rank, so a plain slice keeps the biggest fields
  // when a dense viewport overflows the cap.
  const truncated = hits.length > MAX_RESULTS;

  return NextResponse.json(
    {
      ok: true,
      data: { airports: hits.slice(0, MAX_RESULTS), truncated },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
