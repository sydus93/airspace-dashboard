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

export type AudioMode = "redirect" | "stream";

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

// The same-origin proxy URL for a channel that can't be played directly, or null
// if the channel's own URL is directly playable. `mode` picks the proxy's
// behaviour: "redirect" (resolve to the https stream and hand the browser off to
// it — the phone streams from LiveATC itself, like VLC) or "stream" (relay the
// bytes through us — the fallback, and the only way to reach a private Icecast).
export function proxyUrl(channel: AudioChannel, mode: AudioMode = "redirect"): string | null {
  const at = (m: AudioMode) => `/api/audio?src=${encodeURIComponent(channel.url)}&mode=${m}`;
  if (channel.proxy === false && !isPlaylistUrl(channel.url)) return null; // explicit direct
  // A private Icecast is http-only and only this server can see it — always relay.
  if (channel.backend === "local-icecast") return at("stream");
  if (channel.proxy === true) return at(mode);
  if (isPlaylistUrl(channel.url)) return at(mode);
  if (typeof window !== "undefined") {
    const pageHttps = window.location.protocol === "https:";
    const urlHttp = channel.url.startsWith("http://");
    if (pageHttps && urlHttp) return at(mode); // mixed content -> must proxy
  }
  return null; // play direct
}

// Back-compat helper: the concrete URL to hand <audio>.
export function resolveAudioUrl(channel: AudioChannel, mode: AudioMode = "redirect"): string {
  return proxyUrl(channel, mode) ?? channel.url;
}

class Html5AudioPlayer implements AudioPlayer {
  private el: HTMLAudioElement | null = null;
  private state: AudioPlayerState = { status: "idle", channelId: null, error: null };
  private listeners = new Set<(s: AudioPlayerState) => void>();
  private volume = 0.9;
  private lastProbeUrl: string | null = null;
  private currentChannel: AudioChannel | null = null;
  private triedRelay = false;

  private ensureEl(): HTMLAudioElement {
    if (!this.el) {
      const el = new Audio();
      el.preload = "none";
      el.volume = this.volume;
      el.addEventListener("playing", () =>
        this.set({ status: "playing", error: null })
      );
      el.addEventListener("waiting", () => this.set({ status: "loading" }));
      el.addEventListener("error", () => this.onMediaError());
      el.addEventListener("stalled", () => this.set({ status: "loading" }));
      this.el = el;
    }
    return this.el;
  }

  // A media error on the redirect (direct-play) attempt just means the phone
  // couldn't reach the stream host — retry once through the relay before we give
  // up. Only when the relay fails too do we surface an error (and probe why).
  private onMediaError(): void {
    const ch = this.currentChannel;
    if (ch && !this.triedRelay && proxyUrl(ch, "redirect")) {
      this.triedRelay = true;
      void this.startPlayback(ch, "stream");
      return;
    }
    this.set({ status: "error", error: "stream unavailable" });
    void this.explainFailure();
  }

  // <audio>'s error event carries no useful detail. When we routed through our
  // own proxy, ask it why — it knows (retired feed slug, upstream 403, HTML
  // challenge page) and says so in the body. Abort before pulling any audio.
  private async explainFailure(): Promise<void> {
    const url = this.lastProbeUrl;
    if (!url) return;
    const ctrl = new AbortController();
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store", redirect: "manual" });
      // a 3xx here is success (the redirect handoff worked) — nothing to explain
      if (!res.ok && res.type !== "opaqueredirect" && res.status !== 0) {
        const text = (await res.text()).slice(0, 160);
        if (this.state.status === "error") this.set({ error: text || `upstream ${res.status}` });
      }
    } catch {
      /* probe is best-effort */
    } finally {
      ctrl.abort();
    }
  }

  async play(channel: AudioChannel): Promise<void> {
    this.currentChannel = channel;
    this.triedRelay = false;
    await this.startPlayback(channel, "redirect");
  }

  private async startPlayback(channel: AudioChannel, mode: AudioMode): Promise<void> {
    const el = this.ensureEl();
    const proxied = proxyUrl(channel, mode);
    const url = proxied ?? channel.url;
    // only a proxied URL is worth probing for a failure reason
    this.lastProbeUrl = proxied ? `/api/audio?src=${encodeURIComponent(channel.url)}&mode=stream` : null;
    this.set({ status: "loading", channelId: channel.id, error: null });
    // cache-bust so re-selecting a previously-failed live stream reconnects
    el.src = `${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`;
    el.load();
    try {
      await el.play();
    } catch (err) {
      // Autoplay/gesture rejection is a client-policy issue, not a stream fault —
      // don't trip the relay fallback for it. Media/network faults fire the
      // 'error' event, which drives the fallback instead.
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        this.set({ status: "error", error: "tap play to allow audio" });
      }
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
