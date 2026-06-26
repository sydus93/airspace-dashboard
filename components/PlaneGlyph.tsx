import type { Aircraft } from "@/lib/types";
import { markerColor } from "@/lib/format";

// Top-down plane silhouette (points north), rotated to the track and tinted
// by the altitude/signal ramp — the cartographic glyph used in glass panels.
const PATH =
  "M12 2c.62 0 1 .92 1 2.45V9l8 4.6v1.8l-8-2.55v4.3l2.2 1.65v1.3L12 19.1l-3.2 1.05v-1.3L11 17.15v-4.3L3 15.4v-1.8L11 9V4.45C11 2.92 11.38 2 12 2z";

export default function PlaneGlyph({ ac, size = 13 }: { ac: Aircraft; size?: number }) {
  const color = markerColor(ac);
  const glow =
    ac.emergency && ac.emergency !== "none"
      ? { filter: "drop-shadow(0 0 4px rgba(219,142,114,.6))" }
      : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      style={{ transform: `rotate(${ac.trackDeg ?? 0}deg)`, ...glow }}
      aria-hidden
    >
      <path d={PATH} />
    </svg>
  );
}
