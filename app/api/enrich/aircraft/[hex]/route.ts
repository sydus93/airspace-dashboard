import { NextRequest, NextResponse } from "next/server";
import { getAircraftInfo } from "@/lib/sources/enrich";
import type { AircraftInfo, ApiEnvelope } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ hex: string }> }
) {
  const { hex } = await ctx.params;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return NextResponse.json({ ok: false, error: "bad hex" }, { status: 400 });
  }
  try {
    const info = await getAircraftInfo(hex);
    const body: ApiEnvelope<AircraftInfo | null> = {
      ok: true,
      data: info,
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
        error: err instanceof Error ? err.message : "enrich failed",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
