"use client";

import { useState } from "react";
import MapView from "@/components/MapView";
import StatusBar from "@/components/StatusBar";
import WeatherPanel from "@/components/WeatherPanel";
import OverheadNow from "@/components/OverheadNow";
import TargetCard from "@/components/TargetCard";
import AudioBar from "@/components/AudioBar";
import Poller from "@/components/Poller";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import InstallHint from "@/components/InstallHint";
import LocationSheet from "@/components/LocationSheet";
import ScanAreaPill from "@/components/ScanAreaPill";
import MapOverlays from "@/components/MapOverlays";
import SkyHud from "@/components/SkyHud";

export default function Home() {
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [skyOpen, setSkyOpen] = useState(false);

  return (
    <main className="app">
      <MapView />

      <StatusBar
        onToggleWeather={() => setWeatherOpen((o) => !o)}
        weatherOpen={weatherOpen}
        onOpenLocation={() => setLocationOpen(true)}
        onToggleSky={() => setSkyOpen((o) => !o)}
        skyOpen={skyOpen}
      />
      <WeatherPanel open={weatherOpen} onClose={() => setWeatherOpen(false)} />
      {!weatherOpen && !skyOpen && <OverheadNow />}

      <ScanAreaPill />
      <MapOverlays />

      <div className="bottom-stack">
        <TargetCard />
        <AudioBar />
      </div>

      <SkyHud open={skyOpen} onClose={() => setSkyOpen(false)} />

      <LocationSheet open={locationOpen} onClose={() => setLocationOpen(false)} />
      <InstallHint />

      {/* headless */}
      <Poller />
      <ServiceWorkerRegister />
    </main>
  );
}
