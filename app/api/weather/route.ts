import { NextRequest, NextResponse } from "next/server";
import { fetchMetars } from "@/lib/sources/weather";
import { SingleFlight } from "@/lib/rateLimit";
import { config } from "@/lib/config";
import type { ApiEnvelope, Metar } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const flights = new Map<string, SingleFlight<Metar[]>>();

function flightFor(key: string): SingleFlight<Metar[]> {
  let f = flights.get(key);
  if (!f) {
    // METAR refreshes ~hourly upstream; don't re-hit faster than ~60s even if
    // the client over-polls. Frame considered stale after 10 min.
    f = new SingleFlight(60_000);
    flights.set(key, f);
  }
  return f;
}

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids");
  const ids = (idsParam ? idsParam.split(",") : config.weatherStations)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 25);

  const key = ids.join(",");
  const flight = flightFor(key);
  const cached = await flight.get(() => fetchMetars(ids), 10 * 60_000);

  const body: ApiEnvelope<Metar[]> = {
    ok: cached.value !== null,
    data: cached.value ?? [],
    stale: cached.stale,
    fetchedAt: cached.fetchedAt,
    error: cached.error,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status: cached.value === null && cached.error ? 503 : 200,
  });
}
