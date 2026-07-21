import type { AudioChannel } from "./types";

// Single source of truth (handoff §7). Home point + radius, weather stations,
// audio channels, and a few presentation knobs. Audio URLs are config — never
// hardcoded in components — keeping the LiveATC personal-use boundary clean.

export interface HomeConfig {
  lat: number;
  lon: number;
  radiusNm: number; // airplanes.live max 250
  label: string;
}

export interface LocationPreset {
  label: string;
  lat: number;
  lon: number;
  radiusNm: number;
}

export interface AppConfig {
  home: HomeConfig;
  weatherStations: string[];
  audioChannels: AudioChannel[];
  // Quick-pick locations for the in-app location sheet.
  presets: LocationPreset[];
  // Cap markers rendered for performance on phones (busy airspace near hubs).
  maxAircraft: number;
  // Magnetic declination at the home area, degrees to ADD to a magnetic heading to
  // get true north (negative = west). Used by the Sky HUD compass on the non-iOS
  // path (iOS's webkitCompassHeading is already OS-corrected). ~13°W near Albany.
  magneticDeclinationDeg: number;
}

export const config: AppConfig = {
  home: {
    // KALB — Albany International (gateway to the Catskills / Hudson Valley).
    lat: 42.7483,
    lon: -73.8017,
    radiusNm: 60,
    label: "KALB",
  },
  weatherStations: ["KALB", "KMSV", "KPOU", "KGFL", "KSWF", "KPSF"],
  audioChannels: [
    // backend "remote-stream" = LiveATC/other, personal use only. These are .pls
    // playlist links from the feed page; /api/audio resolves the playlist to the
    // real stream server-side (a browser <audio> element can't parse a .pls).
    //
    // Feed slugs go stale — LiveATC answers an unknown slug with its homepage
    // rather than a 404, which used to fail silently. The proxy now reports
    // "feed not found" for that case. Re-check a dead one at
    // liveatc.net/search/?icao=XXXX (the mount names are in the page's player
    // links, e.g. kalb2_twr — note the digit, they are easy to mistype).
    {
      id: "kalb-twr",
      label: "KALB Tower",
      url: "https://www.liveatc.net/play/kalb2_twr.pls",
      backend: "remote-stream",
      note: "If silent, grab the current .pls from liveatc.net/search/?icao=kalb",
    },
    {
      id: "kalb-gnd",
      label: "KALB Ground",
      url: "https://www.liveatc.net/play/kalb2_gnd.pls",
      backend: "remote-stream",
      note: "If silent, grab the current .pls from liveatc.net/search/?icao=kalb",
    },
    {
      id: "kalb-app",
      label: "Albany Approach/Departure",
      url: "https://www.liveatc.net/play/kalb2_app.pls",
      backend: "remote-stream",
      note: "If silent, grab the current .pls from liveatc.net/search/?icao=kalb",
    },
    {
      id: "kfnl-gnd-twr",
      label: "KFNL Ground/Tower",
      url: "https://www.liveatc.net/play/kfnl3_gnd_twr.pls",
      backend: "remote-stream",
      note: "Northern Colorado Regional. If silent, re-check liveatc.net/search/?icao=kfnl",
    },
    // Example local feed (own RTLSDR-Airband over Tailscale). Disabled by
    // default — set your Icecast mount URL and flip into the list. http over an
    // https PWA is auto-proxied same-origin so it isn't blocked as mixed content.
    // {
    //   id: "local-tower",
    //   label: "KFNL Local (RTLSDR)",
    //   url: "http://your-tailscale-host:8000/tower.mp3",
    //   backend: "local-icecast",
    // },
  ],
  presets: [
    { label: "KALB — Albany", lat: 42.7483, lon: -73.8017, radiusNm: 60 },
    { label: "Catskills (Hunter)", lat: 42.1779, lon: -74.2293, radiusNm: 50 },
    { label: "KMSV — Sullivan Co.", lat: 41.7016, lon: -74.795, radiusNm: 45 },
    { label: "Hudson Valley (KPOU)", lat: 41.6266, lon: -73.8843, radiusNm: 50 },
    { label: "NYC Metro (KJFK)", lat: 40.6413, lon: -73.7781, radiusNm: 60 },
  ],
  maxAircraft: 600,
  magneticDeclinationDeg: -13,
};

// Hosts the audio proxy is willing to fetch (SSRF guard). Configured Icecast
// hosts are added automatically below; LiveATC is allowed by suffix.
export const audioAllowedHostSuffixes = [
  ".liveatc.net",
  "liveatc.net",
];

export function configuredAudioHosts(): string[] {
  const hosts = new Set<string>();
  for (const ch of config.audioChannels) {
    try {
      hosts.add(new URL(ch.url).hostname);
    } catch {
      /* ignore malformed */
    }
  }
  return [...hosts];
}
