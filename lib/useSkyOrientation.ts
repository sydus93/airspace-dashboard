"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Device-orientation plumbing for the Sky HUD's Tier 1 (point-your-phone) mode.
// It turns the messy, platform-specific orientation events into one clean signal:
// a smoothed compass heading (deg clockwise from north) + an approximate pitch
// (the elevation the back camera is aimed at). The compass is the hard part — it's
// noisy, and every platform exposes it differently:
//
//   • iOS Safari: `webkitCompassHeading` — a true-ish heading the OS already
//     corrects with the magnetometer. Best signal; needs requestPermission() off a
//     user gesture, and a secure (https) context.
//   • Android/Chrome: `deviceorientationabsolute` with absolute `alpha`; we derive
//     heading = 360 - alpha and add magnetic declination ourselves.
//   • Desktop / no sensor: unsupported — the HUD stays in Tier 0 (north-up).
//
// Heading is low-pass filtered on the unit circle (smoothing sin/cos, not the raw
// degrees) so it doesn't tear across the 0/360 wrap.

export type CompassPermission =
  | "unsupported" // no orientation events on this device
  | "insecure" // needs https (iOS won't expose the sensor over http)
  | "prompt" // supported; waiting for the user to enable
  | "granted"
  | "denied";

export interface SkyOrientation {
  permission: CompassPermission;
  heading: number | null; // smoothed, deg clockwise from north
  pitch: number | null; // approx elevation aimed at, 0 (horizon) .. 90 (up)
  accuracyDeg: number | null; // iOS webkitCompassAccuracy; large/-1 ⇒ needs calibration
  enable: () => Promise<void>;
}

interface DeviceOrientationEventiOS {
  requestPermission?: () => Promise<"granted" | "denied">;
}

const SMOOTH = 0.22; // low-pass factor; higher = snappier, lower = calmer
const EMIT_MS = 60; // throttle React state updates to ~16 fps

export function useSkyOrientation(opts: {
  active: boolean;
  declinationDeg?: number;
}): SkyOrientation {
  const { active, declinationDeg = 0 } = opts;

  const [permission, setPermission] = useState<CompassPermission>("prompt");
  const [heading, setHeading] = useState<number | null>(null);
  const [pitch, setPitch] = useState<number | null>(null);
  const [accuracyDeg, setAccuracyDeg] = useState<number | null>(null);

  // smoothing + throttle live in refs so the listener stays stable
  const sinRef = useRef<number | null>(null);
  const cosRef = useRef<number | null>(null);
  const lastEmitRef = useRef(0);
  const declRef = useRef(declinationDeg);
  declRef.current = declinationDeg;

  // Initial capability check (can't know granted/denied without asking, so we sit
  // at "prompt" until enable()).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("DeviceOrientationEvent" in window)) {
      setPermission("unsupported");
    } else if (!window.isSecureContext) {
      setPermission("insecure");
    }
  }, []);

  const handle = useCallback((e: DeviceOrientationEvent) => {
    let raw: number | null = null;

    const webkitHeading = (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
      .webkitCompassHeading;
    const webkitAcc = (e as DeviceOrientationEvent & { webkitCompassAccuracy?: number })
      .webkitCompassAccuracy;

    if (typeof webkitHeading === "number" && !Number.isNaN(webkitHeading)) {
      // iOS — already OS-corrected, don't add declination
      raw = webkitHeading;
      setAccuracyDeg(typeof webkitAcc === "number" ? webkitAcc : null);
    } else if (typeof e.alpha === "number" && !Number.isNaN(e.alpha)) {
      // Android/absolute (or desktop emulation) — derive + correct for declination
      raw = (360 - e.alpha + declRef.current) % 360;
    }

    if (raw !== null) {
      const r = (raw * Math.PI) / 180;
      sinRef.current = sinRef.current === null ? Math.sin(r) : sinRef.current * (1 - SMOOTH) + Math.sin(r) * SMOOTH;
      cosRef.current = cosRef.current === null ? Math.cos(r) : cosRef.current * (1 - SMOOTH) + Math.cos(r) * SMOOTH;
    }

    // pitch from front-back tilt (portrait): vertical phone (beta≈90) aims at the
    // horizon, tilt back to aim up. Clamp to the visible dome.
    let nextPitch: number | null = null;
    if (typeof e.beta === "number" && !Number.isNaN(e.beta)) {
      nextPitch = Math.max(0, Math.min(90, e.beta - 90));
    }

    const now = performance.now();
    if (now - lastEmitRef.current < EMIT_MS) return;
    lastEmitRef.current = now;

    if (sinRef.current !== null && cosRef.current !== null) {
      const deg = (Math.atan2(sinRef.current, cosRef.current) * 180) / Math.PI;
      setHeading((deg + 360) % 360);
    }
    setPitch(nextPitch);
  }, []);

  // Attach/detach while the HUD is open and we've been granted access.
  useEffect(() => {
    if (!active || permission !== "granted" || typeof window === "undefined") return;
    const absName = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
    window.addEventListener(absName, handle as EventListener, true);
    if (absName !== "deviceorientation") {
      window.addEventListener("deviceorientation", handle as EventListener, true);
    }
    return () => {
      window.removeEventListener(absName, handle as EventListener, true);
      window.removeEventListener("deviceorientation", handle as EventListener, true);
    };
  }, [active, permission, handle]);

  const enable = useCallback(async () => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setPermission("unsupported");
      return;
    }
    if (!window.isSecureContext) {
      setPermission("insecure");
      return;
    }
    const DOE = window.DeviceOrientationEvent as unknown as DeviceOrientationEventiOS;
    if (typeof DOE.requestPermission === "function") {
      try {
        const res = await DOE.requestPermission();
        setPermission(res === "granted" ? "granted" : "denied");
      } catch {
        setPermission("denied");
      }
    } else {
      // Android / desktop: no explicit permission gate
      setPermission("granted");
    }
  }, []);

  return { permission, heading, pitch, accuracyDeg, enable };
}
