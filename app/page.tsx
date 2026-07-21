"use client";

import { useEffect, useState } from "react";
import { useAirspace } from "@/store/useAirspace";
import MapView from "@/components/MapView";
import Scope from "@/components/Scope";
import StatusBar from "@/components/StatusBar";
import StageChrome, { type Panel } from "@/components/StageChrome";
import TrafficHistogram from "@/components/TrafficHistogram";
import OverheadNow from "@/components/OverheadNow";
import TargetCard from "@/components/TargetCard";
import AudioBar from "@/components/AudioBar";
import WeatherPanel from "@/components/WeatherPanel";
import LayersPanel from "@/components/LayersPanel";
import LocationSheet from "@/components/LocationSheet";
import SkyHud from "@/components/SkyHud";
import ScanAreaPill from "@/components/ScanAreaPill";
import Poller from "@/components/Poller";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import InstallHint from "@/components/InstallHint";

export default function Home() {
  const [panel, setPanel] = useState<Panel>(null);
  const chartMode = useAirspace((s) => s.chartMode);
  const theme = useAirspace((s) => s.theme);

  // Theme lives on <html> so the token overrides reach the body background and
  // the iOS status-bar color too, not just what's inside .app.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "day" ? "#e8e2d0" : "#16181d");
  }, [theme]);

  return (
    <main className="app">
      <StatusBar onOpenLocation={() => setPanel("location")} />

      <section className="stage">
        {/* the Leaflet map stays mounted; the scope overlays it in RADAR mode */}
        <MapView />
        {chartMode === "radar" && <Scope />}
        {chartMode === "sectional" && <ScanAreaPill />}
        <StageChrome panel={panel} setPanel={setPanel} />
      </section>

      <div className="bottom-stack">
        <TrafficHistogram />
        <OverheadNow />
        <AudioBar />
      </div>

      {/* selection slides up over the bottom stack */}
      <TargetCard />

      {/* tool overlays */}
      <SkyHud open={panel === "sky"} onClose={() => setPanel(null)} />
      <WeatherPanel open={panel === "wx"} onClose={() => setPanel(null)} />
      <LayersPanel open={panel === "lyr"} onClose={() => setPanel(null)} />
      <LocationSheet open={panel === "location"} onClose={() => setPanel(null)} />

      <InstallHint />

      {/* headless */}
      <Poller />
      <ServiceWorkerRegister />
    </main>
  );
}
