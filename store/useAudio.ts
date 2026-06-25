"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AudioBackend, AudioChannel } from "@/lib/types";
import { config } from "@/lib/config";

// Persisted channel list (config seeds + user-added streams) and volume.
// Playback state itself lives in the AudioPlayer; this store is just data.

const SEED_VERSION = 2; // bump when config.audioChannels changes, to re-seed clients

interface AudioStoreState {
  channels: AudioChannel[];
  volume: number;
  seedVersion: number;
  addChannel: (c: Omit<AudioChannel, "id">) => void;
  removeChannel: (id: string) => void;
  setVolume: (v: number) => void;
  resetToDefaults: () => void;
}

function makeId(label: string): string {
  return (
    label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

export const useAudio = create<AudioStoreState>()(
  persist(
    (set) => ({
      channels: config.audioChannels,
      volume: 0.9,
      seedVersion: SEED_VERSION,

      addChannel: (c) =>
        set((s) => ({
          channels: [...s.channels, { ...c, id: makeId(c.label || "stream") }],
        })),

      removeChannel: (id) =>
        set((s) => ({ channels: s.channels.filter((ch) => ch.id !== id) })),

      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),

      resetToDefaults: () =>
        set({ channels: config.audioChannels, seedVersion: SEED_VERSION }),
    }),
    {
      name: "airspace-audio",
      // if the bundled seeds change version and the user never customized,
      // pick up the new defaults
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AudioStoreState>;
        if (!p.seedVersion || p.seedVersion < SEED_VERSION) {
          // keep user-added (those whose id isn't a seed id), re-seed the rest
          const seedIds = new Set(config.audioChannels.map((c) => c.id));
          const userAdded = (p.channels ?? []).filter((c) => !seedIds.has(c.id));
          return {
            ...current,
            ...p,
            channels: [...config.audioChannels, ...userAdded],
            seedVersion: SEED_VERSION,
          };
        }
        return { ...current, ...p };
      },
    }
  )
);

export type { AudioBackend };
