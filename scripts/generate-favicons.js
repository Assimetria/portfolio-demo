#!/usr/bin/env node

/**
 * generate-favicons.js
 *
 * Generates all favicon variants from the canonical logo in assets/logos/.
 * Outputs to assets/favicons/ (webpack CopyPlugin copies them to dist).
 *
 * Usage: node scripts/generate-favicons.js
 */

import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LOGOS_DIR = resolve(ROOT, "assets/logos");
const FAVICONS_DIR = resolve(ROOT, "assets/favicons");

const SVG_SOURCE = resolve(LOGOS_DIR, "logo-mark.svg");
const SVG_FALLBACK = resolve(LOGOS_DIR, "logo.svg");
const PNG_SOURCE = resolve(LOGOS_DIR, "logo.png");

async function main() {
  // Determine source: prefer logo-mark.svg (square mark), fall back to logo.svg, then logo.png
  const useMark = existsSync(SVG_SOURCE);
  const useSvgFallback = !useMark && existsSync(SVG_FALLBACK);
  const source = useMark ? SVG_SOURCE : useSvgFallback ? SVG_FALLBACK : PNG_SOURCE;

  if (!existsSync(source)) {
    console.error(
      "ERROR: No logo found. Place logo-mark.svg, logo.svg, or logo.png in assets/logos/",
    );
    process.exit(1);
  }

  const sourceName = useMark ? "logo-mark.svg" : useSvgFallback ? "logo.svg (fallback)" : "logo.png (fallback)";
  console.log(`Source: ${sourceName}`);

  // Ensure output directory exists
  mkdirSync(FAVICONS_DIR, { recursive: true });

  // 1. favicon.svg — only generate if missing (custom hand-optimized version takes priority)
  const faviconSvgPath = resolve(FAVICONS_DIR, "favicon.svg");
  if (!existsSync(faviconSvgPath) && (useMark || useSvgFallback)) {
    copyFileSync(source, faviconSvgPath);
    console.log("  favicon.svg            (copy of source — no custom version found)");
  } else if (existsSync(faviconSvgPath)) {
    console.log("  favicon.svg            (skipped — custom version exists)");
  }

  // 2. Generate PNG variants
  const pngVariants = [
    { name: "favicon.png", size: 32 },
    { name: "apple-touch-icon.png", size: 180 },
    { name: "favicon-192.png", size: 192 },
    { name: "favicon-512.png", size: 512 },
  ];

  for (const { name, size } of pngVariants) {
    await sharp(source)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(resolve(FAVICONS_DIR, name));
    console.log(`  ${name.padEnd(24)} (${size}x${size})`);
  }

  // 3. Generate multi-size ICO (16, 32, 48)
  const icoSizes = [16, 32, 48];
  const icoBuffers = await Promise.all(
    icoSizes.map((size) =>
      sharp(source)
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ),
  );
  const icoBuffer = await pngToIco(icoBuffers);
  writeFileSync(resolve(FAVICONS_DIR, "favicon.ico"), icoBuffer);
  console.log(`  favicon.ico            (${icoSizes.join(", ")}px multi-size)`);

  console.log("\nDone. All favicons written to assets/favicons/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
