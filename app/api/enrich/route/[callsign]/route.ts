import { NextRequest, NextResponse } from "next/server";
import { getRoute } from "@/lib/sources/enrich";
import type { ApiEnvelope, FlightRoute } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ callsign: string }> }
) {
  const { callsign } = await ctx.params;
  if (!/^[A-Za-z0-9]{2,8}$/.test(callsign)) {
    return NextResponse.json({ ok: false, error: "bad callsign" }, { status: 400 });
  }
  try {
    const route = await getRoute(callsign);
    const body: ApiEnvelope<FlightRoute | null> = {
      ok: true,
      data: route,
      stale: false,
      fetchedAt: Date.now(),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        data: null,
        stale: true,
        fetchedAt: Date.now(),
        error: err instanceof Error ? err.message : "route lookup failed",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
