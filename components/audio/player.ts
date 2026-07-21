"use client";

import type { AudioChannel } from "@/lib/types";

// Thin AudioPlayer boundary (handoff §8). Call sites never branch on backend;
// they hand a channel to play()/stop(). A native background-audio plugin can
// implement this same interface later (Capacitor stage) without touching the UI.

export type AudioStatus = "idle" | "loading" | "playing" | "error";

export interface AudioPlayerState {
  status: AudioStatus;
  channelId: string | null;
  error: string | null;
}

export interface AudioPlayer {
  play(channel: AudioChannel): Promise<void>;
  stop(): void;
  setVolume(v: number): void;
  subscribe(cb: (s: AudioPlayerState) => void): () => void;
  getState(): AudioPlayerState;
}

// A .pls / .m3u is a playlist, not audio — <audio> can't decode it, and the
// browser can't unwrap it either (cross-origin fetch is CORS-blocked). It has to
// go through the proxy, which resolves it to the real stream server-side.
export function isPlaylistUrl(url: string): boolean {
  try {
    return /\.(pls|m3u)$/i.test(new URL(url, "http://x.invalid").pathname);
  } catch {
    return false;
  }
}

// Decide whether a channel must route through the same-origin proxy.
export function resolveAudioUrl(channel: AudioChannel): string {
  const proxied = () => `/api/audio?src=${encodeURIComponent(channel.url)}`;
  if (channel.proxy === false && !isPlaylistUrl(channel.url)) return channel.url;
  if (channel.proxy === true) return proxied();
  if (isPlaylistUrl(channel.url)) return proxied();
  // defaults: local Icecast and http-on-https must be proxied (mixed content)
  if (channel.backend === "local-icecast") return proxied();
  if (typeof window !== "undefined") {
    const pageHttps = window.location.protocol === "https:";
    const urlHttp = channel.url.startsWith("http://");
    if (pageHttps && urlHttp) return proxied();
  }
  return channel.url;
}

class Html5AudioPlayer implements AudioPlayer {
  private el: HTMLAudioElement | null = null;
  private state: AudioPlayerState = { status: "idle", channelId: null, error: null };
  private listeners = new Set<(s: AudioPlayerState) => void>();
  private volume = 0.9;
  private lastUrl: string | null = null;

  private ensureEl(): HTMLAudioElement {
    if (!this.el) {
      const el = new Audio();
      el.preload = "none";
      el.volume = this.volume;
      el.addEventListener("playing", () =>
        this.set({ status: "playing", error: null })
      );
      el.addEventListener("waiting", () => this.set({ status: "loading" }));
      el.addEventListener("error", () => {
        this.set({ status: "error", error: "stream unavailable" });
        // <audio>'s error event carries no useful detail. When we're going
        // through our own proxy, ask it why — it knows (retired feed slug,
        // upstream 403, HTML challenge page) and says so in the body.
        void this.explainFailure();
      });
      el.addEventListener("stalled", () => this.set({ status: "loading" }));
      this.el = el;
    }
    return this.el;
  }

  // Probe the proxy for a human-readable reason, then abort before we pull any
  // of the stream body.
  private async explainFailure(): Promise<void> {
    const url = this.lastUrl;
    if (!url || !url.startsWith("/api/audio")) return;
    const ctrl = new AbortController();
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) {
        const text = (await res.text()).slice(0, 160);
        if (this.state.status === "error") {
          this.set({ error: text || `upstream ${res.status}` });
        }
      }
    } catch {
      /* probe is best-effort */
    } finally {
      ctrl.abort();
    }
  }

  async play(channel: AudioChannel): Promise<void> {
    const el = this.ensureEl();
    const url = resolveAudioUrl(channel);
    this.lastUrl = url;
    this.set({ status: "loading", channelId: channel.id, error: null });
    // cache-bust so re-selecting a previously-failed live stream reconnects
    el.src = `${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`;
    el.load();
    try {
      await el.play();
    } catch (err) {
      this.set({
        status: "error",
        error: err instanceof Error ? err.message : "playback blocked",
      });
      throw err;
    }
  }

  stop(): void {
    if (this.el) {
      this.el.pause();
      this.el.removeAttribute("src");
      this.el.load();
    }
    this.set({ status: "idle", channelId: null, error: null });
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.el) this.el.volume = this.volume;
  }

  subscribe(cb: (s: AudioPlayerState) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => this.listeners.delete(cb);
  }

  getState(): AudioPlayerState {
    return this.state;
  }

  private set(partial: Partial<AudioPlayerState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l(this.state));
  }
}

// module singleton — one audio element for the whole app
let singleton: AudioPlayer | null = null;
export function getAudioPlayer(): AudioPlayer {
  if (!singleton) singleton = new Html5AudioPlayer();
  return singleton;
}
