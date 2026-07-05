"use client";

import { useAirspace } from "@/store/useAirspace";
import { altBand, ALT_RAMP, ALT_BAND_LABELS } from "@/lib/format";

// FIG 01 — traffic by altitude band. An editorial figure caption over a small
// hatched bar chart: how the contacts in range distribute across altitude.
export default function TrafficHistogram() {
  const frame = useAirspace((s) => s.frame);
  const list = frame?.aircraft ?? [];

  const counts = [0, 0, 0, 0, 0];
  for (const a of list) counts[altBand(a)]++;
  const max = Math.max(1, ...counts);
  const n = list.length;

  // top-down: high bands first
  const order = [4, 3, 2, 1, 0];

  return (
    <section className="fig">
      <div className="fig-head">
        <span className="fig-cap">FIG&nbsp;01 · TRAFFIC BY BAND</span>
        <span className="fig-n">n&nbsp;=&nbsp;{n}</span>
      </div>
      <div className="fig-body">
        {order.map((i) => (
          <div className="hist-row" key={i}>
            <span className="hist-lbl">{ALT_BAND_LABELS[i]}</span>
            <span className="hist-track">
              <span
                className="hist-fill"
                style={{ width: `${Math.round((counts[i] / max) * 100)}%`, background: ALT_RAMP[i] }}
              />
            </span>
            <span className="hist-count">{counts[i]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
