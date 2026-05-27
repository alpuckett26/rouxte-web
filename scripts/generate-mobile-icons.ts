/**
 * Generates iOS + Android launch icons + Play Store assets from inline SVGs.
 *
 * Placeholder design: brand-blue square with the green Rouxte "X" element.
 * Submission-acceptable; swap in a real designed icon when ready by editing
 * SQUARE_SVG, ADAPTIVE_FG_SVG, and FEATURE_GRAPHIC_SVG below and rerunning.
 *
 * Usage: npx tsx scripts/generate-mobile-icons.ts
 */

import sharp from "sharp";
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

const REPO = path.resolve(__dirname, "..");
const MOBILE = path.join(REPO, "mobile");

const BLUE = "#1BAEE1";
const GREEN = "#72C41A";

// Full-bleed square icon: green X strokes on brand blue.
const SQUARE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${BLUE}"/>
  <g stroke="${GREEN}" stroke-width="180" stroke-linecap="round">
    <line x1="256" y1="256" x2="768" y2="768"/>
    <line x1="768" y1="256" x2="256" y2="768"/>
  </g>
</svg>`;

// Adaptive-icon foreground: transparent bg, X kept inside the safe zone
// (66% of canvas) so it survives circular / squircle / rounded-square masks.
const ADAPTIVE_FG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <g stroke="${GREEN}" stroke-width="180" stroke-linecap="round">
    <line x1="340" y1="340" x2="684" y2="684"/>
    <line x1="684" y1="340" x2="340" y2="684"/>
  </g>
</svg>`;

// Play Store feature graphic — 1024×500. Wordmark over a brand-gradient strip.
const FEATURE_GRAPHIC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1024" y2="500" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0A4D6E"/>
      <stop offset="100%" stop-color="${BLUE}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <g transform="translate(190 145)">
    <g stroke="${GREEN}" stroke-width="42" stroke-linecap="round">
      <line x1="48" y1="48" x2="160" y2="160"/>
      <line x1="160" y1="48" x2="48" y2="160"/>
    </g>
  </g>
  <g transform="translate(440 195)" fill="#ffffff">
    <text font-family="Arial Black, Impact, Helvetica, sans-serif" font-weight="900" font-size="84" letter-spacing="-2">ROUXTE</text>
    <text y="60" font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="28" opacity="0.8">Door-to-door fiber, without SPOTIO pricing.</text>
  </g>
</svg>`;

async function pngAt(svg: string, size: number, outPath: string) {
  await mkdir(path.dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
}

async function pngRect(svg: string, width: number, height: number, outPath: string) {
  await mkdir(path.dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(outPath);
}

// ── iOS AppIcon.appiconset ────────────────────────────────────────────────────

interface IosSpec {
  filename: string;
  size: number;
  scale: 1 | 2 | 3;
  idiom: "iphone" | "ipad" | "ios-marketing";
  pointSize: string; // e.g. "20x20"
}

const IOS_ICONS: IosSpec[] = [
  // iPhone
  { filename: "AppIcon-20@2x.png",   size: 40,   scale: 2, idiom: "iphone",        pointSize: "20x20" },
  { filename: "AppIcon-20@3x.png",   size: 60,   scale: 3, idiom: "iphone",        pointSize: "20x20" },
  { filename: "AppIcon-29@2x.png",   size: 58,   scale: 2, idiom: "iphone",        pointSize: "29x29" },
  { filename: "AppIcon-29@3x.png",   size: 87,   scale: 3, idiom: "iphone",        pointSize: "29x29" },
  { filename: "AppIcon-40@2x.png",   size: 80,   scale: 2, idiom: "iphone",        pointSize: "40x40" },
  { filename: "AppIcon-40@3x.png",   size: 120,  scale: 3, idiom: "iphone",        pointSize: "40x40" },
  { filename: "AppIcon-60@2x.png",   size: 120,  scale: 2, idiom: "iphone",        pointSize: "60x60" },
  { filename: "AppIcon-60@3x.png",   size: 180,  scale: 3, idiom: "iphone",        pointSize: "60x60" },
  // iPad
  { filename: "AppIcon-20.png",      size: 20,   scale: 1, idiom: "ipad",          pointSize: "20x20" },
  { filename: "AppIcon-20@2x-ipad.png", size: 40, scale: 2, idiom: "ipad",         pointSize: "20x20" },
  { filename: "AppIcon-29.png",      size: 29,   scale: 1, idiom: "ipad",          pointSize: "29x29" },
  { filename: "AppIcon-29@2x-ipad.png", size: 58, scale: 2, idiom: "ipad",         pointSize: "29x29" },
  { filename: "AppIcon-40.png",      size: 40,   scale: 1, idiom: "ipad",          pointSize: "40x40" },
  { filename: "AppIcon-40@2x-ipad.png", size: 80, scale: 2, idiom: "ipad",         pointSize: "40x40" },
  { filename: "AppIcon-76.png",      size: 76,   scale: 1, idiom: "ipad",          pointSize: "76x76" },
  { filename: "AppIcon-76@2x.png",   size: 152,  scale: 2, idiom: "ipad",          pointSize: "76x76" },
  { filename: "AppIcon-83.5@2x.png", size: 167,  scale: 2, idiom: "ipad",          pointSize: "83.5x83.5" },
  // Marketing
  { filename: "AppIcon-1024.png",    size: 1024, scale: 1, idiom: "ios-marketing", pointSize: "1024x1024" },
];

async function generateIos() {
  const iconsetDir = path.join(MOBILE, "ios/RouxteApp/Images.xcassets/AppIcon.appiconset");
  for (const spec of IOS_ICONS) {
    await pngAt(SQUARE_SVG, spec.size, path.join(iconsetDir, spec.filename));
  }
  // Contents.json so Xcode picks them up
  const contents = {
    images: IOS_ICONS.map((s) => ({
      filename: s.filename,
      idiom: s.idiom,
      scale: `${s.scale}x`,
      size: s.pointSize,
    })),
    info: { author: "rouxte-icon-script", version: 1 },
  };
  await writeFile(path.join(iconsetDir, "Contents.json"), JSON.stringify(contents, null, 2));
  console.log(`✓ iOS: ${IOS_ICONS.length} icon sizes + Contents.json`);
}

// ── Android mipmap + adaptive icon ────────────────────────────────────────────

const ANDROID_DENSITIES: Array<{ density: string; launcher: number; foreground: number }> = [
  { density: "mdpi",    launcher: 48,  foreground: 108 },
  { density: "hdpi",    launcher: 72,  foreground: 162 },
  { density: "xhdpi",   launcher: 96,  foreground: 216 },
  { density: "xxhdpi",  launcher: 144, foreground: 324 },
  { density: "xxxhdpi", launcher: 192, foreground: 432 },
];

async function generateAndroid() {
  const resDir = path.join(MOBILE, "android/app/src/main/res");

  for (const { density, launcher, foreground } of ANDROID_DENSITIES) {
    // Legacy mipmaps (pre-Android 8) — full-bleed square
    await pngAt(SQUARE_SVG, launcher, path.join(resDir, `mipmap-${density}/ic_launcher.png`));
    await pngAt(SQUARE_SVG, launcher, path.join(resDir, `mipmap-${density}/ic_launcher_round.png`));
    // Adaptive icon foreground (Android 8+) — transparent bg + safe zone X
    await pngAt(ADAPTIVE_FG_SVG, foreground, path.join(resDir, `drawable-${density}/ic_launcher_foreground.png`));
  }

  // Replace any older vector-drawable foreground so the new PNGs take effect
  const oldVector = path.join(resDir, "drawable/ic_launcher_foreground.xml");
  if (existsSync(oldVector)) {
    await rm(oldVector);
    console.log("  removed obsolete drawable/ic_launcher_foreground.xml");
  }

  // Adaptive icon XML — point to our drawable + brand-blue color resource
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`;
  await writeFile(path.join(resDir, "mipmap-anydpi-v26/ic_launcher.xml"), adaptiveXml);
  await writeFile(path.join(resDir, "mipmap-anydpi-v26/ic_launcher_round.xml"), adaptiveXml);

  // Background color resource
  const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BLUE}</color>
</resources>
`;
  await mkdir(path.join(resDir, "values"), { recursive: true });
  await writeFile(path.join(resDir, "values/ic_launcher_background.xml"), colorsXml);

  console.log(`✓ Android: 5 densities × (launcher + round + adaptive fg) + adaptive XML + background color`);
}

// ── Marketing / Store assets ──────────────────────────────────────────────────

async function generateStoreAssets() {
  const storeDir = path.join(MOBILE, "store-assets");

  // Play Console: high-res icon (512×512) for the store listing
  await pngAt(SQUARE_SVG, 512, path.join(storeDir, "play-icon-512.png"));

  // Play Console: feature graphic (1024×500). Required for store listing.
  await pngRect(FEATURE_GRAPHIC_SVG, 1024, 500, path.join(storeDir, "play-feature-1024x500.png"));

  // Extra: 1024×1024 source PNG of the icon (useful for App Store Connect upload)
  await pngAt(SQUARE_SVG, 1024, path.join(storeDir, "appstore-icon-1024.png"));

  console.log(`✓ Store assets: play-icon-512, play-feature-1024x500, appstore-icon-1024`);
}

async function main() {
  console.log("Generating mobile icons + store assets...");
  await generateIos();
  await generateAndroid();
  await generateStoreAssets();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error("Icon generation failed:", e);
  process.exit(1);
});
