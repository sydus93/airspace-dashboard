# Airspace Dashboard — v1 Data Layer Handoff

**Working title:** `airspace-dashboard` (rename freely)
**Audience:** Claude Code build agent
**Scope of this doc:** the v1 data layer and audio abstraction only. UI/visual design, 3D, and alerting are out of scope here but seams are marked.

---

## 1. What we are building

A single personal interface that fuses, in real time, for a chosen point/radius:

1. **Live traffic** — ADS-B/MLAT aircraft positions.
2. **Aviation weather** — METAR, TAF, PIREP for nearby stations.
3. **Aircraft enrichment** — type, owner, photo, and origin→destination route for a selected target.
4. **ATC audio** — one or more channels, from either a self-hosted receiver or a remote stream.

Goal is experiential ("feel the airspace"), personal-use, single operator. Not a product, not multi-tenant.

---

## 2. v1 scope

**In:**
- Traffic poller (airplanes.live) at 1 Hz over a configurable point + radius.
- Weather fetcher (aviationweather.gov) for METAR/TAF/PIREP.
- Enrichment (adsbdb.com), lazy and cached, on target selection.
- Audio source abstraction with two backends: local Icecast and remote stream URL.
- A thin server-side proxy layer for all HTTP data sources (handles User-Agent, caching, CORS, central rate limiting).
- A normalized in-memory data model the UI subscribes to.

**Explicitly deferred (build seams, do not implement):**
- Airspace / sectional overlay (OpenAIP) — fast-follow.
- Emergency/squawk/military highlighting — cheap fast-follow, see §8.
- 3D terrain view, alerting/Openclaw hooks, DVR/recording, OpenSky, TFR, D-ATIS, NEXRAD — phase 2.

---

## 3. Recommended stack

- **Next.js (App Router) + TypeScript**, configured as a PWA. Matches existing tooling.
- **Map:** MapLibre GL JS (open, vector, no API token; clean upgrade path to deck.gl for later 3D).
- **State:** Zustand (or plain React state) — a single store the poller writes to and components read from.
- **Server proxy:** Next.js route handlers under `/app/api/*` proxy every external source. Rationale: airplanes.live and aviationweather.gov are not CORS-friendly for browser polling, and a server-side proxy lets the 1 req/sec limit be enforced once regardless of how many tabs/clients are open.
- **Audio:** client-side HTML5 `<audio>`, kept behind a thin `AudioPlayer` interface (see §8) so a native background-audio plugin can swap in later without touching call sites.
- **Optional persistence (phase 2):** SQLite, for DVR/history. Not needed for v1.

The data contracts in §6 are framework-agnostic so the same shapes port to a native shell later. Reference implementation here is TypeScript.

**Platform decision (June 2026):** ship v1 as a Next.js PWA; defer native. The staged path (PWA → Capacitor wrap → Swift only if ever) and what changes at each stage is in **Appendix A**.

---

## 4. Data sources reference

| Source | Purpose | Auth | Rate limit | ToU / licensing |
|---|---|---|---|---|
| airplanes.live | Live traffic | none | **1 req/sec** | Free, non-commercial. Set custom User-Agent. |
| aviationweather.gov | METAR/TAF/PIREP | none | be polite | US gov, public. Schema changed Sept 2025 — build against current OpenAPI. Set custom User-Agent. |
| adsbdb.com | Aircraft + route enrichment | none | be polite | Free. **Route data is not republishable** — display only, do not persist into a redistributable DB. |
| Local Icecast (own RTLSDR-Airband) | ATC audio | per-server | n/a | Clean (own receiver). Preferred. |
| Remote stream (e.g. LiveATC) | ATC audio fallback | none | n/a | **Personal use only.** Treat as a configured URL, never bundle/redistribute. |

### Endpoints

**Traffic** — `GET https://api.airplanes.live/v2/point/{lat}/{lon}/{radius}`
- `radius` in nautical miles, max 250.
- Returns `{ ac: Aircraft[], now: number, total: number }`.
- Relevant raw fields: `hex`, `flight` (callsign), `r` (registration), `t` (ICAO type), `alt_baro` (number **or** the string `"ground"`), `alt_geom`, `gs`, `track`, `baro_rate`, `squawk`, `emergency`, `category`, `lat`, `lon`, `seen_pos`, `dbFlags` (bit 0 = military), `mlat`, `tisb`, `rssi`.

**Weather** — base `https://aviationweather.gov/api/data`
- METAR: `/metar?ids={ICAO,ICAO}&format=json`
- TAF: `/taf?ids={ICAO}&format=json`
- PIREP: `/pirep?id={ICAO}&distance={nm}&format=json` (confirm params against current OpenAPI; PIREP supports point/bbox queries).

**Enrichment** — base `https://api.adsbdb.com/v0`
- Aircraft: `/aircraft/{mode_s|registration}` → type, manufacturer, registration, owner, photo URLs.
- Route: `/callsign/{callsign_icao}` → airline, origin, destination (each with lat/lon/ICAO).
- Combined: `/aircraft/{mode_s}?callsign={callsign}`.

---

## 5. Architecture

```
┌─────────────────────────── client (PWA) ───────────────────────────┐
│  MapLibre view  │  weather panel  │  target card  │  audio bar      │
│        └──────────────── subscribes to store ────────────────┘      │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │ fetch (same-origin)
┌───────────────────────────────▼─────────────── Next.js server ──────┐
│  /api/traffic   /api/weather   /api/enrich/*                         │
│   (each: adds User-Agent, caches, enforces rate limit, normalizes)   │
└──────┬───────────────┬───────────────────┬──────────────────────────┘
       │               │                   │
 airplanes.live  aviationweather.gov   adsbdb.com

  Audio is direct client → Icecast/stream URL (no proxy).
```

**Polling cadence**
- Traffic: client requests `/api/traffic` every **1000 ms**. Server keeps a single-flight lock + ≥1000 ms spacing to airplanes.live so multiple clients never exceed 1 req/sec upstream; it serves the last cached frame between upstream refreshes.
- Weather: every **5 min** (the upstream refreshes on roughly that cadence).
- Enrichment: **lazy** — only on target selection. Cache by `hex` (aircraft, long TTL) and by `callsign` (route, medium TTL). Never enrich the whole visible set.

**Resilience**
- All external calls: timeout, try/catch, exponential backoff on 429/5xx.
- Stale-while-revalidate: serve last good frame; mark data `stale` after 2 missed cycles so UI can dim it.
- A dead source must degrade gracefully, never blank the whole view.

---

## 6. Normalized data model (TypeScript)

```typescript
// Traffic — normalized from airplanes.live
export interface Aircraft {
  hex: string;                 // 24-bit ICAO, stable key
  callsign: string | null;     // trimmed `flight`
  registration: string | null;
  typeCode: string | null;     // ICAO type, e.g. "C172"
  lat: number;
  lon: number;
  altBaroFt: number | null;    // null when on ground
  onGround: boolean;           // alt_baro === "ground"
  altGeomFt: number | null;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  verticalRateFpm: number | null;
  squawk: string | null;
  emergency: string | null;    // "none" | "general" | "7700"-class etc.
  isMilitary: boolean;         // dbFlags bit 0
  category: string | null;
  positionAgeSec: number | null; // seen_pos
  source: "adsb" | "mlat" | "tisb" | "other";
}

export interface TrafficFrame {
  aircraft: Aircraft[];
  fetchedAt: number;           // epoch ms
  stale: boolean;
}

// Weather
export interface Metar {
  icaoId: string;
  raw: string;
  observedAt: string;          // ISO
  tempC: number | null;
  dewpointC: number | null;
  windDirDeg: number | null;
  windSpeedKt: number | null;
  visibilityMi: number | null;
  altimeterInHg: number | null;
  flightCategory: "VFR" | "MVFR" | "IFR" | "LIFR" | null;
}

export interface Taf { icaoId: string; raw: string; issuedAt: string; validFrom: string; validTo: string; }

export interface Pirep {
  raw: string;
  receivedAt: string;
  lat: number | null;
  lon: number | null;
  altitudeFt: number | null;
  turbulence: string | null;
  icing: string | null;
}

// Enrichment
export interface AircraftInfo {
  typeName: string | null;     // "PA-18-150"
  manufacturer: string | null;
  registration: string | null;
  owner: string | null;
  photoUrl: string | null;
  photoThumbUrl: string | null;
}

export interface FlightRoute {
  callsign: string;
  airlineName: string | null;
  origin: Airport | null;
  destination: Airport | null;
}

export interface Airport { icao: string; iata: string | null; name: string; lat: number; lon: number; }

// Audio
export type AudioBackend = "local-icecast" | "remote-stream";
export interface AudioChannel {
  id: string;
  label: string;               // "KFNL Tower"
  freqMhz?: number;            // 120.55
  url: string;                 // Icecast mount or stream URL
  backend: AudioBackend;
}
```

---

## 7. Module contracts

Each lives behind a server route and a typed client fetcher. Suggested layout:

```
/lib
  /sources
    traffic.ts        // fetchTraffic(lat, lon, radiusNm) -> TrafficFrame
    weather.ts        // fetchMetars(ids[]) / fetchTafs(ids[]) / fetchPireps(id, distNm)
    enrich.ts         // getAircraftInfo(hex) / getRoute(callsign) — memoized
  normalize.ts        // raw upstream JSON -> normalized models (§6)
  rateLimit.ts        // single-flight lock + min-spacing for airplanes.live
  config.ts           // home point, radius, station list, audio channels
/app/api
  /traffic/route.ts
  /weather/route.ts
  /enrich/aircraft/[hex]/route.ts
  /enrich/route/[callsign]/route.ts
/store
  useAirspace.ts      // Zustand store; poller writes frames, components read
```

**Config (single source of truth):**
```typescript
export const config = {
  home: { lat: 40.4519, lon: -105.0112, radiusNm: 60 }, // KFNL default — adjust
  weatherStations: ["KFNL", "KGXY", "KDEN", "KBJC", "KLMO"],
  audioChannels: [
    // backend "local-icecast" = own RTLSDR-Airband feed over Tailscale
    // backend "remote-stream" = LiveATC/other, personal use only
  ] as AudioChannel[],
};
```

**Rate-limit contract (airplanes.live):**
```typescript
// single-flight: one upstream request at a time, >=1000ms apart.
// between upstream refreshes, /api/traffic returns the cached frame.
// on 429: back off, keep serving last good frame as stale.
```

---

## 8. Fast-follow seams (do not build, but leave room)

- **Emergency / mil highlight:** normalization already exposes `emergency`, `squawk`, `isMilitary`. A pure-derived selector `isNotable(ac)` (squawk ∈ {7500,7600,7700} or `emergency !== "none"` or `isMilitary`) is all that's needed. Keep it a selector over `TrafficFrame`, not new fetching.
- **Airspace overlay:** add a parallel `sources/airspace.ts` (OpenAIP vector + sectional raster tiles, needs a free API key) feeding a separate map layer. Independent of traffic; must not share the 1 Hz cycle.
- **3D:** keep the renderer behind a `MapView` boundary so swapping MapLibre 2D for deck.gl/Cesium touches rendering only, not the store or sources.
- **Alerting:** the store's frame stream is the natural subscription point. A rule evaluator can emit events (later: POST to an Openclaw webhook). Do not couple into the poller.

---

## 9. Build order

1. Scaffold Next.js + TS + PWA shell, MapLibre view centered on `config.home`.
2. `rateLimit.ts` + `/api/traffic` + `traffic.ts` + `normalize.ts` → markers rendering and updating at 1 Hz.
3. Store wiring; target selection (click marker → selected `hex`).
4. `/api/weather` + weather panel for `config.weatherStations`.
5. `/api/enrich/*` lazy on selection → target card with type/owner/photo + route line drawn origin→destination.
6. Audio bar driven by `config.audioChannels`, `<audio>` per active channel, backend-agnostic.
7. Resilience pass: timeouts, backoff, stale flags, graceful single-source failure.

---

## 10. Acceptance criteria (v1 done)

- Markers reflect real traffic within radius and refresh ~1 Hz; **upstream airplanes.live is never hit faster than 1 req/sec** even with two tabs open.
- Selecting a target shows enrichment (when available) and, for airline callsigns, a drawn route line.
- Weather panel shows current METAR + flight category per configured station, refreshing ~5 min.
- At least one local-icecast and one remote-stream channel play through the same audio control with no code branching at the call site.
- Killing any one source (block its route) degrades only that panel; the rest stays live.
- All outbound external requests carry a custom `User-Agent`.

---

## 11. Notes / constraints to respect

- **Latency mismatch:** remote ATC streams buffer 10–30 s; traffic is near-real-time. Do not attempt to sync a transmission to a specific target. Local Icecast (~<0.5 s) is much closer if low latency matters.
- **`alt_baro` is `"ground"` (string) when on the ground** — normalization must handle this, not coerce to NaN.
- **Do not persist adsbdb route data** into any redistributable store; cache in memory / ephemeral only.
- **Audio sources are config, never hardcoded URLs in components.** Keeps the LiveATC personal-use boundary clean and makes the local feed swap trivial.

---

## 12. References

- airplanes.live API: https://airplanes.live/api-guide/
- aviationweather.gov Data API: https://aviationweather.gov/data/api/
- adsbdb: https://www.adsbdb.com/ · https://github.com/mrjackwills/adsbdb
- RTLSDR-Airband (self-hosted audio): https://github.com/rtl-airband/RTLSDR-Airband
- OpenAIP (airspace, fast-follow): https://www.openaip.net/
- Capacitor (native wrap, phase 2): https://capacitorjs.com/

---

## Appendix A — Platform path (PWA-first, Capacitor later, Swift maybe-never)

The data layer in §4–§7 is identical across every stage below. Only the shell and the audio backend change. Build v1 as Stage 1 and stop; the later stages are documented so nothing in v1 forecloses them.

### Stage 1 — Next.js PWA (now)

The whole v1. Same toolchain already in use elsewhere. Runs as an installable PWA on phone and also in a desktop browser (a bonus for a second-monitor airspace view). Cost: $0, no accounts.

One known limitation to accept, not fix: iOS may suspend a PWA's audio when it is backgrounded or the screen locks. For v1 this is fine — the dashboard is a screen-on, foreground experience (watch traffic, listen). If that gap becomes the actual pain point in practice, that is the trigger for Stage 2, and only then.

### Stage 2 — Capacitor wrap (only if locked-screen audio becomes the pain point)

Capacitor takes the **finished web build** and wraps it in a native iOS shell. No rewrite, same TypeScript codebase. It buys exactly one thing we care about: real background audio plus lock-screen play/pause controls, via a background-audio plugin that implements the `AudioPlayer` interface from §8. Everything else stays as-is.

Two things to know before committing:

- **The API has to live somewhere.** A Capacitor shell wraps the *client* bundle; it does not run the Next.js server inside it. The `/app/api/*` proxy routes (§5) must be hosted on a reachable machine — the simplest personal option is the always-on Ubuntu box on the Tailscale network, with the shell pointed at that origin. This is why §5 keeps the proxy cleanly separable; honor that boundary in v1 so this stage stays a wrap and not a refactor.
- **Apple cost, accurately.** Sideloading a Capacitor build onto a personal device with a **free** Apple ID works, but the signing profile expires after 7 days, so it must be re-deployed from Xcode roughly weekly. The **$99/yr** Apple Developer Program removes that (1-year signing, TestFlight, App Store). For personal-only use the free 7-day-resign route is the no-fee path; it is just fiddly.

### Stage 3 — Swift native (only if the situation changes)

A full rewrite in Swift/Xcode. Worth it only if one of these becomes true: a portfolio of iOS apps emerges to amortize the learning curve and the $99/yr, **or** the project moves toward wider/commercial deployment. Note the second case carries a hard dependency beyond platform: public/commercial distribution requires replacing the LiveATC remote feed (personal-use-only) with a licensed source or an owned-receiver network, so the audio-source question must be solved before, or alongside, any native rewrite. The §6 data contracts carry over as a design reference but get reimplemented in Swift.

### Decision summary

| Stage | When | Effort | Cost | Unlocks |
|---|---|---|---|---|
| 1. Next.js PWA | Now | Low (existing skills) | $0 | Full v1, phone + desktop |
| 2. Capacitor wrap | If backgrounded audio matters | Low (wrap, no rewrite) | $0 free-resign, or $99/yr | Background + lock-screen ATC audio |
| 3. Swift native | If multi-app or commercial | High (new language) | $99/yr + audio licensing | Deepest OS access, store distribution |
