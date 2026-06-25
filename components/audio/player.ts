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

// Decide whether a channel must route through the same-origin proxy.
export function resolveAudioUrl(channel: AudioChannel): string {
  const proxied = () => `/api/audio?src=${encodeURIComponent(channel.url)}`;
  if (channel.proxy === true) return proxied();
  if (channel.proxy === false) return channel.url;
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

  private ensureEl(): HTMLAudioElement {
    if (!this.el) {
      const el = new Audio();
      el.preload = "none";
      el.volume = this.volume;
      el.addEventListener("playing", () =>
        this.set({ status: "playing", error: null })
      );
      el.addEventListener("waiting", () => this.set({ status: "loading" }));
      el.addEventListener("error", () =>
        this.set({ status: "error", error: "stream unavailable" })
      );
      el.addEventListener("stalled", () => this.set({ status: "loading" }));
      this.el = el;
    }
    return this.el;
  }

  async play(channel: AudioChannel): Promise<void> {
    const el = this.ensureEl();
    const url = resolveAudioUrl(channel);
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
