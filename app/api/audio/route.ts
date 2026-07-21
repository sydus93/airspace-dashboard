import { NextRequest } from "next/server";
import { audioAllowedHostSuffixes, configuredAudioHosts } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Same-origin audio relay. Two jobs:
//  1. Let an https PWA play an http:// Icecast feed (otherwise blocked as mixed
//     content) — the local RTLSDR-Airband feed over Tailscale.
//  2. Add a browser-like UA/Referer + dodge CORS for remote streams.
// Backend-agnostic: the AudioPlayer just points <audio> at /api/audio?src=...
//
// SSRF guard: public hosts are allowed; private/loopback hosts only if they are
// an explicitly configured audio channel host (your own Icecast). Cloud metadata
// endpoints are always blocked.

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

// A .pls is an INI playlist (`File1=http://...`); a .m3u is one URL per line.
// <audio> can't decode either — it needs the stream they point AT. This is the
// same resolution a desktop media player does with LiveATC's "launches your MP3
// player" link; we just do it server-side so the phone gets playable audio.
function parsePlaylist(body: string): string | null {
  const pls = body.match(/^\s*File\d*\s*=\s*(\S+)\s*$/im);
  if (pls) return pls[1];
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (t && !t.startsWith("#") && /^https?:\/\//i.test(t)) return t;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src");
  if (!src) return new Response("missing src", { status: 400 });

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return new Response("bad src", { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return new Response("unsupported scheme", { status: 400 });
  }
  if (!hostAllowed(target.hostname)) {
    return new Response("host not allowed", { status: 403 });
  }

  // Resolve playlist indirection first (max 2 hops), re-running the SSRF guard on
  // every hop so a playlist can't redirect us at a private host.
  try {
    for (let hop = 0; hop < 2; hop++) {
      if (!/\.(pls|m3u)$/i.test(target.pathname)) break;
      const res = await fetch(target.toString(), {
        headers: BROWSER_HEADERS,
        signal: req.signal,
        cache: "no-store",
        redirect: "follow",
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) return new Response(`playlist ${res.status}`, { status: 502 });
      if (ct.includes("text/html")) {
        // LiveATC serves its homepage for an unknown/retired feed slug rather
        // than a 404 — the single most common cause of a silent channel.
        return new Response(
          "feed not found — that playlist name no longer exists upstream (check the .pls link on the feed page)",
          { status: 502 }
        );
      }
      const body = await res.text();
      const next = parsePlaylist(body);
      if (!next) return new Response("playlist had no stream url", { status: 502 });
      let nextUrl: URL;
      try {
        nextUrl = new URL(next, target);
      } catch {
        return new Response("playlist had a bad stream url", { status: 502 });
      }
      if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
        return new Response("unsupported scheme", { status: 400 });
      }
      if (!hostAllowed(nextUrl.hostname)) {
        return new Response("host not allowed", { status: 403 });
      }
      target = nextUrl;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "playlist error";
    return new Response(msg, { status: 502 });
  }

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
    // If the relay handed back HTML (e.g. a Cloudflare challenge), surface it as
    // an error rather than feeding HTML to <audio>.
    if (ct.includes("text/html")) {
      return new Response("upstream returned HTML (likely a challenge page)", {
        status: 502,
      });
    }
    // A playlist here means the indirection above didn't unwrap (e.g. a stream
    // host that hands back another .pls) — <audio> would silently fail on it.
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
    const msg = err instanceof Error ? err.message : "proxy error";
    return new Response(msg, { status: 502 });
  }
}
