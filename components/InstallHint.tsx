"use client";

import { useEffect, useState } from "react";

// Lightweight "Add to Home Screen" nudge. iOS has no install API, so we show a
// one-time tip with the Share→Add to Home Screen instruction. Dismissed forever.
export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem("airspace-install-dismissed");
    if (dismissed) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIOS) {
      const t = setTimeout(() => setShow(true), 4000);
      return () => clearTimeout(t);
    }
  }, []);

  if (!show) return null;
  return (
    <div className="install-hint">
      <div>
        Install: tap <strong>Share</strong> <span aria-hidden>⎙</span> →{" "}
        <strong>Add to Home Screen</strong> for a full-screen airspace view.
      </div>
      <button
        className="icon-btn"
        onClick={() => {
          localStorage.setItem("airspace-install-dismissed", "1");
          setShow(false);
        }}
        aria-label="dismiss"
      >
        ✕
      </button>
    </div>
  );
}
