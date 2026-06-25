"use client";

import { useEffect, useRef } from "react";
import { useAirspace } from "@/store/useAirspace";
import { config } from "@/lib/config";
import { enrichAircraft, enrichRoute, getTraffic, getWeather } from "@/lib/client/api";
import { isAirlineCallsign } from "@/lib/format";

const TRAFFIC_MS = 1000;
const WEATHER_MS = 5 * 60_000;

// Headless component: owns the polling loops and lazy enrichment. Mounted once.
export default function Poller() {
  const setFrame = useAirspace((s) => s.setFrame);
  const setWeather = useAirspace((s) => s.setWeather);
  const home = useAirspace((s) => s.home);

  // keep latest home in a ref so the loop reads current values without resubscribing
  const homeRef = useRef(home);
  homeRef.current = home;

  // ---- traffic: 1 Hz, paused when tab hidden ----
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let aborted = false;
    let inflight: AbortController | null = null;

    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) {
        schedule();
        return;
      }
      const { lat, lon, radiusNm } = homeRef.current;
      inflight = new AbortController();
      try {
        const env = await getTraffic(lat, lon, radiusNm, inflight.signal);
        if (!aborted) setFrame(env.data, env.stale, env.error ?? null);
      } catch (err) {
        if (!aborted && (err as Error)?.name !== "AbortError") {
          useAirspace.setState({
            trafficStale: true,
            trafficError: (err as Error)?.message ?? "network error",
          });
        }
      } finally {
        schedule();
      }
    };

    const schedule = () => {
      if (aborted) return;
      timer = setTimeout(tick, TRAFFIC_MS);
    };

    tick();
    const onVis = () => {
      if (!document.hidden) {
        // resume promptly when returning to the app
        if (timer) clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      aborted = true;
      if (timer) clearTimeout(timer);
      inflight?.abort();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [setFrame]);

  // ---- weather: every 5 min ----
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let aborted = false;

    const load = async () => {
      try {
        const env = await getWeather(config.weatherStations);
        if (!aborted) setWeather(env.data, env.stale, env.error ?? null);
      } catch (err) {
        if (!aborted) {
          useAirspace.setState({
            weatherStale: true,
            weatherError: (err as Error)?.message ?? "network error",
          });
        }
      }
    };

    load();
    timer = setInterval(load, WEATHER_MS);
    return () => {
      aborted = true;
      if (timer) clearInterval(timer);
    };
  }, [setWeather]);

  // ---- lazy enrichment on selection ----
  const selectedHex = useAirspace((s) => s.selectedHex);
  useEffect(() => {
    if (!selectedHex) return;
    const st = useAirspace.getState();
    const ac = st.frame?.aircraft.find((a) => a.hex === selectedHex) ?? null;
    const existing = st.enrichments[selectedHex];

    // aircraft info — once per hex
    if (!existing || (existing.info === null && !existing.infoLoading && !hasInfo(existing))) {
      st.setInfoLoading(selectedHex, true);
      enrichAircraft(selectedHex)
        .then((env) => useAirspace.getState().setInfo(selectedHex, env.data))
        .catch(() => useAirspace.getState().setInfo(selectedHex, null));
    }

    // route — only for airline callsigns, once per hex
    const callsign = ac?.callsign ?? null;
    if (callsign && isAirlineCallsign(callsign)) {
      const cur = useAirspace.getState().enrichments[selectedHex];
      if (!cur || (cur.route === null && !cur.routeLoading)) {
        useAirspace.getState().setRouteLoading(selectedHex, true);
        enrichRoute(callsign)
          .then((env) => useAirspace.getState().setRoute(selectedHex, env.data))
          .catch(() => useAirspace.getState().setRoute(selectedHex, null));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHex]);

  return null;
}

// treat an enrichment record that's been resolved (loading flipped false after a
// fetch) as "has info" so we don't refetch a confirmed miss
function hasInfo(e: { infoLoading: boolean; info: unknown }): boolean {
  return e.infoLoading === false && e.info !== undefined;
}
