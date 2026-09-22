#!/usr/bin/env node
/**
 * ensure-transparent-logo.js
 *
 * Pre-build check: ensures client/public/logo.png has an alpha channel (RGBA).
 * If the image is RGB-only (no transparency), auto-removes white/near-white
 * background and saves as RGBA PNG.
 *
 * Runs before brand asset generation in the build pipeline.
 * Usage: node scripts/ensure-transparent-logo.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const LOGO_PATH = path.resolve(__dirname, '..', 'client', 'public', 'logo.png');
const WHITE_THRESHOLD = 240; // pixels with R,G,B all >= this are treated as "white bg"

async function main() {
  if (!fs.existsSync(LOGO_PATH)) {
    console.log('⚠️  No logo.png found — skipping transparency check');
    return;
  }

  const img = sharp(LOGO_PATH);
  const metadata = await img.metadata();

  // Already has alpha channel — verify it's actually used
  if (metadata.channels === 4) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    let opaquePixels = 0;
    let totalPixels = info.width * info.height;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 255) opaquePixels++;
    }
    const alphaUsage = 1 - (opaquePixels / totalPixels);
    if (alphaUsage > 0.005) {
      console.log(`✅ logo.png already has transparency (${(alphaUsage * 100).toFixed(1)}% transparent pixels)`);
      return;
    }
    console.log('⚠️  logo.png has alpha channel but no transparent pixels — removing white bg');
  } else {
    console.log(`⚠️  logo.png is ${metadata.channels}-channel (no alpha) — removing white bg`);
  }

  // Remove white background
  const { data, info } = await sharp(LOGO_PATH)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let removed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
      // Fade out near-white pixels proportionally
      const brightness = (r + g + b) / 3;
      const alpha = Math.max(0, Math.round(255 * (1 - (brightness - WHITE_THRESHOLD) / (255 - WHITE_THRESHOLD))));
      data[i + 3] = alpha;
      removed++;
    }
  }

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(LOGO_PATH);

  const pct = ((removed / (info.width * info.height)) * 100).toFixed(1);
  console.log(`✅ Removed white bg from ${removed} pixels (${pct}%) — saved as RGBA PNG`);
}

main().catch(err => {
  console.error('❌ ensure-transparent-logo failed:', err.message);
  process.exit(1);
});
