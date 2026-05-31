/**
 * Composites raw phone screenshots into store-ready, captioned, brand-framed
 * assets at the exact pixel sizes the App Store and Play Store require.
 *
 * Workflow:
 *   1. Capture raw screenshots on a device/emulator running the app. Use a
 *      DEMO org with fake leads — never real customer names/addresses/phones.
 *   2. Drop them in mobile/store-assets/raw-screens/ named NN-slug.png
 *      (e.g. 01-map.png). The leading number sets carousel order.
 *   3. Map each slug to a caption in CAPTIONS below.
 *   4. Run:  npx tsx scripts/generate-store-screenshots.ts
 *
 * Output (per source screenshot):
 *   mobile/store-assets/screenshots/play/NN-slug-1080x1920.png
 *   mobile/store-assets/screenshots/ios67/NN-slug-1290x2796.png
 *
 * Each output is the brand-blue canvas with a white caption band at the top
 * and the raw screenshot centered below, scaled to fit with rounded corners.
 * The raw aspect ratio is preserved (letterboxed onto the brand canvas), so
 * screenshots from any phone size composite cleanly.
 */

import sharp from "sharp";
import { mkdir, readdir } from "fs/promises";
import path from "path";

const REPO = path.resolve(__dirname, "..");
const MOBILE = path.join(REPO, "mobile");
const RAW_DIR = path.join(MOBILE, "store-assets/raw-screens");
const OUT_DIR = path.join(MOBILE, "store-assets/screenshots");

const BLUE = "#1BAEE1";
const DARK = "#0A4D6E";
const WHITE = "#FFFFFF";

// slug (filename without the NN- prefix and .png) -> caption shown in the band.
const CAPTIONS: Record<string, string> = {
  map: "Your whole territory, at a glance",
  lead: "Know before you knock",
  quote: "Quote on the doorstep",
  dashboard: "Watch your numbers climb",
  leaderboard: "Compete with your team",
  training: "Coaching in your pocket",
  settings: "You're in control of your data",
};

// Store target sizes (portrait).
interface Target {
  name: string;
  width: number;
  height: number;
}
const TARGETS: Target[] = [
  { name: "play", width: 1080, height: 1920 }, // Google Play phone
  { name: "ios69", width: 1320, height: 2868 }, // Apple 6.9" iPhone (required)
  { name: "ipad13", width: 2064, height: 2752 }, // Apple 13" iPad (required, portrait)
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** The brand canvas: gradient background + white caption band + title text. */
function canvasSvg(w: number, h: number, caption: string): Buffer {
  const bandH = Math.round(h * 0.16);
  const fontSize = Math.round(w * 0.052);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${w}" y2="${h}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${DARK}"/>
      <stop offset="100%" stop-color="${BLUE}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <text x="${w / 2}" y="${bandH * 0.62}" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="800"
        font-size="${fontSize}" fill="${WHITE}">${escapeXml(caption)}</text>
</svg>`;
  return Buffer.from(svg);
}

/** Rounded-corner mask for the device screenshot. */
function roundedMask(w: number, h: number, r: number): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`
  );
}

async function processOne(file: string) {
  const base = file.replace(/\.png$/i, ""); // e.g. "01-map"
  const slug = base.replace(/^\d+-/, ""); // e.g. "map"
  const caption = CAPTIONS[slug] ?? slug.replace(/-/g, " ");

  const srcPath = path.join(RAW_DIR, file);

  for (const t of TARGETS) {
    // The screenshot occupies the area below the caption band, with margins.
    const bandH = Math.round(t.height * 0.16);
    const marginX = Math.round(t.width * 0.07);
    const marginBottom = Math.round(t.height * 0.05);
    const slotW = t.width - marginX * 2;
    const slotH = t.height - bandH - marginBottom;

    // Fit the raw screenshot into the slot, preserving aspect ratio.
    const fitted = await sharp(srcPath)
      .resize(slotW, slotH, { fit: "inside", withoutEnlargement: false })
      .toBuffer();
    const meta = await sharp(fitted).metadata();
    const fw = meta.width ?? slotW;
    const fh = meta.height ?? slotH;

    // Round the corners of the fitted screenshot.
    const radius = Math.round(Math.min(fw, fh) * 0.04);
    const rounded = await sharp(fitted)
      .composite([{ input: roundedMask(fw, fh, radius), blend: "dest-in" }])
      .png()
      .toBuffer();

    // Center the rounded screenshot horizontally; place just below the band.
    const left = Math.round((t.width - fw) / 2);
    const top = bandH + Math.round((slotH - fh) / 2);

    const outSubdir = path.join(OUT_DIR, t.name);
    await mkdir(outSubdir, { recursive: true });
    const outPath = path.join(outSubdir, `${base}-${t.width}x${t.height}.png`);

    await sharp(canvasSvg(t.width, t.height, caption))
      .composite([{ input: rounded, left, top }])
      .png()
      .toFile(outPath);

    console.log(`  ✓ ${t.name}: ${path.relative(REPO, outPath)}`);
  }
}

async function main() {
  let files: string[];
  try {
    files = (await readdir(RAW_DIR)).filter((f) => /\.png$/i.test(f)).sort();
  } catch {
    console.error(
      `No raw screenshots found. Create ${path.relative(REPO, RAW_DIR)}/ ` +
        `and add NN-slug.png files (e.g. 01-map.png), then rerun.`
    );
    process.exit(1);
  }

  if (!files.length) {
    console.error(
      `${path.relative(REPO, RAW_DIR)}/ is empty. Add NN-slug.png screenshots ` +
        `(slugs: ${Object.keys(CAPTIONS).join(", ")}).`
    );
    process.exit(1);
  }

  console.log(`Compositing ${files.length} screenshot(s) → ${TARGETS.length} store sizes each...\n`);
  for (const file of files) {
    console.log(`${file}:`);
    await processOne(file);
  }
  console.log(`\nDone. Upload from ${path.relative(REPO, OUT_DIR)}/{play,ios67}/.`);
}

main().catch((e) => {
  console.error("Screenshot generation failed:", e);
  process.exit(1);
});
