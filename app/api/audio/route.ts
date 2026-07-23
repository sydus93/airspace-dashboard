import { NextRequest } from "next/server";
import { audioAllowedHostSuffixes, configuredAudioHosts } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Only the streaming fallback holds the function open; the default "redirect"
// mode returns immediately. Raise the ceiling anyway (plan-capped) so the
// fallback doesn't cut a stream mid-listen on plans that allow it.
export const maxDuration = 300;

// Same-origin audio relay for the ATC bar. Its job is subtler than "proxy the
// bytes", because of how LiveATC is actually gatekept (learned the hard way):
//
//   • www.liveatc.net (the WEBSITE, where the .pls playlist links live) is
//     behind Cloudflare and returns 403 to datacenter/hosting IPs — i.e. to a
//     Vercel function. So we must NEVER fetch the .pls from a server. That was
//     the "stream failed" bug on prod.
//   • d.liveatc.net / s1-*.liveatc.net (the STREAM servers) are NOT IP-gated;
//     they serve audio to anyone, datacenter or phone. That's the way in.
//
// A LiveATC play link maps to its stream with a fixed rule, no website needed:
//     https://www.liveatc.net/play/<slug>.pls  ->  http://d.liveatc.net/<slug>
// and d.liveatc.net 302-redirects to a per-request https://s1-*.liveatc.net URL.
//
// Two modes:
//   mode=redirect (default): resolve to the final https stream URL and 302 the
//     browser to it, so the PHONE streams directly from LiveATC — exactly like
//     VLC, from your own IP, over https (no mixed content), and with no Vercel
//     function held open (dodges the serverless stream-duration cap).
//   mode=stream: relay the bytes through here. Fallback for when the phone can't
//     reach the stream host directly, and the path for a private Icecast feed
//     (own RTLSDR over Tailscale) that only this server can see.

const BLOCKED_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata",
]);

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  // Tailscale CGNAT range 100.64.0.0/10 and *.ts.net are "private" to this app.
  if (h.endsWith(".ts.net")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT / Tailscale
    if (a === 169 && b === 254) return true;
  }
  return false;
}

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  if (BLOCKED_HOSTS.has(h)) return false;
  const configured = configuredAudioHosts().map((x) => x.toLowerCase());
  if (configured.includes(h)) return true;
  if (audioAllowedHostSuffixes.some((sfx) => h === sfx || h.endsWith(sfx))) return true;
  if (isPrivateHost(h)) return false; // private but not configured -> deny
  return true; // public host -> allow (personal use)
}

const BROWSER_HEADERS: Record<string, string> = {
  // present as a normal browser; many ATC relays gate on this
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  Referer: "https://www.liveatc.net/",
  Accept: "audio/mpeg, audio/aac, audio/ogg, */*",
  // deliberately NOT requesting Icy-MetaData so we get a clean audio stream
};

const PLAYLIST_TYPES = [
  "audio/x-scpls",
  "application/pls+xml",
  "audio/x-mpegurl",
  "audio/mpegurl",
  "application/x-mpegurl",
];

function looksLikePlaylist(url: URL, contentType: string): boolean {
  if (/\.(pls|m3u)$/i.test(url.pathname)) return true;
  return PLAYLIST_TYPES.some((t) => contentType.includes(t));
}

// The slug<->stream rule above. Returns the direct stream mount for a LiveATC
// play/.pls or d.liveatc.net URL, so we skip the 403'ing website entirely.
function liveatcMount(u: URL): URL | null {
  const h = u.hostname.toLowerCase();
  if (h === "www.liveatc.net" || h === "liveatc.net") {
    const m = u.pathname.match(/^\/play\/([A-Za-z0-9_-]+)\.pls$/i);
    if (m) return new URL(`http://d.liveatc.net/${m[1]}`);
  }
  if (h === "d.liveatc.net") return u; // already a mount
  return null;
}

// A .pls is an INI playlist (`File1=http://...`); a .m3u is one URL per line.
// <audio> can't decode either. Used only for NON-LiveATC playlists (the LiveATC
// path never fetches a playlist — see liveatcMount).
function parsePlaylist(body: string): string | null {
  const pls = body.match(/^\s*File\d*\s*=\s*(\S+)\s*$/im);
  if (pls) return pls[1];
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (t && !t.startsWith("#") && /^https?:\/\//i.test(t)) return t;
  }
  return null;
}

function guard(u: URL): string | null {
  if (u.protocol !== "http:" && u.protocol !== "https:") return "unsupported scheme";
  if (!hostAllowed(u.hostname)) return "host not allowed";
  return null;
}

// Follow redirects by hand (max 3), SSRF-guarding each hop, without pulling the
// audio body. Returns the final URL and its status so the caller can decide
// whether it's a directly-playable https stream.
async function resolveFinal(
  start: URL,
  signal: AbortSignal
): Promise<{ url: URL; status: number; contentType: string } | { error: string }> {
  let cur = start;
  for (let hop = 0; hop < 3; hop++) {
    const res = await fetch(cur.toString(), {
      headers: BROWSER_HEADERS,
      redirect: "manual",
      signal,
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      res.body?.cancel().catch(() => {});
      if (!loc) return { url: cur, status: res.status, contentType: "" };
      let next: URL;
      try {
        next = new URL(loc, cur);
      } catch {
        return { error: "bad redirect target" };
      }
      const bad = guard(next);
      if (bad) return { error: bad };
      cur = next;
      continue;
    }
    res.body?.cancel().catch(() => {});
    return { url: cur, status: res.status, contentType: res.headers.get("content-type") || "" };
  }
  return { url: cur, status: 0, contentType: "" };
}

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src");
  if (!src) return new Response("missing src", { status: 400 });
  const mode = req.nextUrl.searchParams.get("mode") === "stream" ? "stream" : "redirect";

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return new Response("bad src", { status: 400 });
  }
  {
    const bad = guard(target);
    if (bad) return new Response(bad, { status: bad === "host not allowed" ? 403 : 400 });
  }

  // LiveATC: rewrite straight to the stream mount, never touching the website.
  const mount = liveatcMount(target);
  if (mount) target = mount;

  // Non-LiveATC playlist: resolve it server-side (works from a residential IP /
  // a private Icecast; a LiveATC .pls never reaches here).
  if (!mount && /\.(pls|m3u)$/i.test(target.pathname)) {
    try {
      for (let hop = 0; hop < 2 && /\.(pls|m3u)$/i.test(target.pathname); hop++) {
        const res = await fetch(target.toString(), {
          headers: BROWSER_HEADERS,
          signal: req.signal,
          cache: "no-store",
          redirect: "follow",
        });
        if (!res.ok) return new Response(`playlist ${res.status}`, { status: 502 });
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/html")) {
          return new Response(
            "feed not found — that playlist name no longer exists upstream (check the .pls link on the feed page)",
            { status: 502 }
          );
        }
        const next = parsePlaylist(await res.text());
        if (!next) return new Response("playlist had no stream url", { status: 502 });
        let nextUrl: URL;
        try {
          nextUrl = new URL(next, target);
        } catch {
          return new Response("playlist had a bad stream url", { status: 502 });
        }
        const bad = guard(nextUrl);
        if (bad) return new Response(bad, { status: bad === "host not allowed" ? 403 : 400 });
        target = nextUrl;
      }
    } catch (err) {
      return new Response(err instanceof Error ? err.message : "playlist error", { status: 502 });
    }
  }

  // Preferred path: resolve to the final https stream URL and hand the browser
  // a redirect, so the phone streams directly from LiveATC (VLC-equivalent).
  if (mode === "redirect") {
    try {
      const r = await resolveFinal(target, req.signal);
      if ("error" in r) return new Response(r.error, { status: 502 });
      // Only redirect the browser to https — an http stream on our https page
      // would be blocked as mixed content, so that case falls through to relay.
      if (r.url.protocol === "https:" && (r.status === 200 || r.status === 0)) {
        return Response.redirect(r.url.toString(), 302);
      }
    } catch (err) {
      // fall through to relay on any resolve failure
      if ((err as Error)?.name === "AbortError") return new Response(null, { status: 499 });
    }
    // else: no https stream to hand off (e.g. private Icecast) -> relay below.
  }

  // Relay mode: pull the bytes through here. Fallback for a phone that can't
  // reach the stream host, and the only path for a private/http Icecast feed.
  try {
    const upstream = await fetch(target.toString(), {
      headers: BROWSER_HEADERS,
      signal: req.signal,
      cache: "no-store",
      redirect: "follow",
    });
    if (!upstream.ok || !upstream.body) {
      return new Response(`upstream ${upstream.status}`, { status: 502 });
    }
    const ct = upstream.headers.get("content-type") || "audio/mpeg";
    if (ct.includes("text/html")) {
      return new Response("upstream returned HTML (likely a challenge page)", { status: 502 });
    }
    if (looksLikePlaylist(target, ct)) {
      return new Response("upstream returned a playlist, not audio", { status: 502 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "proxy error", { status: 502 });
  }
}
