import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// FAA VFR Sectional raster proxy. The upstream ArcGIS tiles are served as
// `application/octet-stream` with `X-Content-Type-Options: nosniff`, so a browser
// refuses to paint them in an <img>. We fetch server-side and re-serve the exact
// bytes with the correct image content-type. Tiles are immutable per chart cycle,
// so they cache hard at the edge.
const UPSTREAM =
  "https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ z: string; y: string; x: string }> }
) {
  const { z, y, x } = await ctx.params;
  if (![z, y, x].every((v) => /^\d{1,3}$/.test(v))) {
    return new NextResponse("bad tile coord", { status: 400 });
  }

  try {
    const res = await fetchWithTimeout(`${UPSTREAM}/${z}/${y}/${x}`, {
      timeoutMs: 9000,
      headers: { Accept: "image/jpeg,image/png,*/*" },
    });
    if (!res.ok) {
      // outside sectional coverage / above native zoom — let Leaflet skip it
      return new NextResponse(null, { status: 204 });
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        // chart cycle changes every 56 days; a day of edge cache is safe + fast
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
