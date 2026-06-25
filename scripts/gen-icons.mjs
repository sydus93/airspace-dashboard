// Generate PWA icons from an inline SVG (radar scope + aircraft).
// Run: npm run icons
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public");

// content scale: smaller for maskable so it survives the platform mask
function svg({ scale = 0.78, bgRadius = 96 } = {}) {
  const S = 512;
  const c = S / 2;
  const r = (S / 2) * scale;
  // radar rings
  const rings = [0.32, 0.58, 0.85]
    .map(
      (f) =>
        `<circle cx="${c}" cy="${c}" r="${r * f}" fill="none" stroke="#3fd6c8" stroke-opacity="${0.18 + f * 0.12}" stroke-width="2.5"/>`
    )
    .join("");
  // plane silhouette pointing up-right, centered
  const plane = `
    <g transform="translate(${c} ${c}) rotate(35) scale(${scale * 2.05})">
      <path fill="#eafffb" d="M0,-46 C3,-46 5,-40 5,-30 L6,-12 L44,10 L44,20 L6,10 L5,28 L20,42 L20,48 L0,40 L-20,48 L-20,42 L-5,28 L-6,10 L-44,20 L-44,10 L-6,-12 L-5,-30 C-5,-40 -3,-46 0,-46 Z"/>
    </g>`;
  // sweep wedge
  const sweep = `
    <defs>
      <radialGradient id="sweep" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#3fd6c8" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#3fd6c8" stop-opacity="0"/>
      </radialGradient>
    </defs>`;
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" rx="${bgRadius}" fill="#05080c"/>
  <rect width="${S}" height="${S}" rx="${bgRadius}" fill="#0a1018"/>
  ${sweep}
  <circle cx="${c}" cy="${c}" r="${r}" fill="url(#sweep)"/>
  ${rings}
  <line x1="${c}" y1="${c - r}" x2="${c}" y2="${c + r}" stroke="#3fd6c8" stroke-opacity="0.12" stroke-width="2"/>
  <line x1="${c - r}" y1="${c}" x2="${c + r}" y2="${c}" stroke="#3fd6c8" stroke-opacity="0.12" stroke-width="2"/>
  ${plane}
</svg>`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const jobs = [
    { name: "icon-192.png", size: 192, opts: { scale: 0.82 } },
    { name: "icon-512.png", size: 512, opts: { scale: 0.82 } },
    { name: "icon-maskable-512.png", size: 512, opts: { scale: 0.62, bgRadius: 0 } },
    { name: "apple-touch-icon.png", size: 180, opts: { scale: 0.82, bgRadius: 0 } },
    { name: "favicon-32.png", size: 32, opts: { scale: 0.9, bgRadius: 6 } },
  ];
  for (const j of jobs) {
    await sharp(svg(j.opts)).resize(j.size, j.size).png().toFile(join(OUT, j.name));
    console.log("wrote", j.name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
