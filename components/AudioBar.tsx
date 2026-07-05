"use client";

import { useEffect, useState } from "react";
import { useAudio } from "@/store/useAudio";
import { getAudioPlayer, type AudioPlayerState } from "@/components/audio/player";
import type { AudioBackend } from "@/lib/types";

// static-ish waveform bar heights (px), reused whether idle or live
const WAVE = [4, 7, 5, 9, 6, 11, 8, 12, 7, 10, 6, 9, 5, 8];

export default function AudioBar() {
  const channels = useAudio((s) => s.channels);
  const volume = useAudio((s) => s.volume);
  const setVolume = useAudio((s) => s.setVolume);
  const addChannel = useAudio((s) => s.addChannel);
  const removeChannel = useAudio((s) => s.removeChannel);
  const resetToDefaults = useAudio((s) => s.resetToDefaults);

  const [pstate, setPstate] = useState<AudioPlayerState>({ status: "idle", channelId: null, error: null });
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const player = getAudioPlayer();
    player.setVolume(volume);
    return player.subscribe(setPstate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getAudioPlayer().setVolume(volume);
  }, [volume]);

  const playing = pstate.status === "playing" || pstate.status === "loading";
  const current = channels.find((c) => c.id === pstate.channelId);

  const toggle = (id: string) => {
    const player = getAudioPlayer();
    if (pstate.channelId === id && playing) {
      player.stop();
      return;
    }
    const ch = channels.find((c) => c.id === id);
    if (ch) player.play(ch).catch(() => {});
  };

  return (
    <div className="audiobar">
      <div className="ab-main">
        <button
          className={`ab-power ${playing ? "on" : ""}`}
          onClick={() => (playing ? getAudioPlayer().stop() : setExpanded((e) => !e))}
          title={playing ? "Stop" : "ATC audio"}
        >
          {pstate.status === "loading" ? "…" : playing ? "■" : "▸"}
        </button>

        <button className="ab-now" onClick={() => setExpanded((e) => !e)}>
          {current ? (
            <>
              <span className="ab-now-label">{current.label}</span>
              {current.freqMhz && <span className="ab-freq">{current.freqMhz.toFixed(2)} MHz</span>}
            </>
          ) : (
            <span className="ab-now-idle">ATC — tap to choose a channel</span>
          )}
        </button>

        <span className={`ab-wave ${playing ? "on" : ""}`} aria-hidden>
          {WAVE.map((h, i) => (
            <span key={i} style={{ height: `${h}px` }} />
          ))}
        </span>

        <button className="ab-expand" onClick={() => setExpanded((e) => !e)} aria-label="channels">
          {expanded ? "▾" : "▸"}
        </button>
      </div>

      {pstate.status === "error" && (
        <div className="ab-error">
          Stream failed{current?.note ? ` — ${current.note}` : "."} Try another channel or a fresh URL.
        </div>
      )}

      {expanded && (
        <div className="ab-tray">
          <div className="ab-tray-head">
            <span className="ab-tray-title">STATIONS</span>
          </div>

          {channels.map((ch) => {
            const active = ch.id === pstate.channelId && playing;
            return (
              <div key={ch.id} className={`ab-chip ${active ? "active" : ""}`}>
                <button className="ab-chip-btn" onClick={() => toggle(ch.id)}>
                  {active && <span className="ab-chip-live" />}
                  {ch.label}
                  {ch.freqMhz ? ` · ${ch.freqMhz.toFixed(2)}` : ""}
                </button>
                {editing && (
                  <button className="ab-chip-x" onClick={() => removeChannel(ch.id)} aria-label={`remove ${ch.label}`}>
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          {channels.length === 0 && <div className="ab-help">No channels — add one below.</div>}

          <div className="ab-actions">
            <button className="link-btn" onClick={() => setAdding((a) => !a)}>
              {adding ? "Cancel" : "+ Add stream"}
            </button>
            <button className="link-btn" onClick={() => setEditing((e) => !e)}>
              {editing ? "Done" : "Edit"}
            </button>
            <button className="link-btn dim" onClick={() => resetToDefaults()}>
              Reset
            </button>
          </div>

          {adding && (
            <AddStreamForm
              onAdd={(c) => {
                addChannel(c);
                setAdding(false);
              }}
            />
          )}

          <div className="ab-vol-row">
            <span className="ab-vol-lbl">Vol</span>
            <input
              className="ab-vol"
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="volume"
            />
            <span className="ab-vol-pct">{Math.round(volume * 100)}%</span>
          </div>

          <p className="ab-help">
            Streams are personal-use. Grab a URL from a feed page on liveatc.net (the <code>.pls</code>{" "}
            link) and paste it above.
          </p>
        </div>
      )}
    </div>
  );
}

function AddStreamForm({
  onAdd,
}: {
  onAdd: (c: { label: string; url: string; freqMhz?: number; backend: AudioBackend; proxy?: boolean }) => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [freq, setFreq] = useState("");
  const [backend, setBackend] = useState<AudioBackend>("remote-stream");
  const [proxy, setProxy] = useState(false);

  const submit = () => {
    if (!url.trim()) return;
    onAdd({
      label: label.trim() || url,
      url: url.trim(),
      freqMhz: freq ? Number(freq) : undefined,
      backend,
      proxy: proxy || undefined,
    });
    setLabel("");
    setUrl("");
    setFreq("");
  };

  return (
    <div className="ab-form">
      <input placeholder="Label (e.g. KAPA Tower)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <input placeholder="Stream URL (https://…)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="ab-form-row">
        <input
          className="ab-form-freq"
          placeholder="Freq MHz"
          value={freq}
          onChange={(e) => setFreq(e.target.value)}
          inputMode="decimal"
        />
        <select value={backend} onChange={(e) => setBackend(e.target.value as AudioBackend)}>
          <option value="remote-stream">Remote (LiveATC)</option>
          <option value="local-icecast">Local Icecast</option>
        </select>
        <label className="ab-form-proxy">
          <input type="checkbox" checked={proxy} onChange={(e) => setProxy(e.target.checked)} /> proxy
        </label>
        <button className="ab-form-add" onClick={submit}>
          Add
        </button>
      </div>
    </div>
  );
}
