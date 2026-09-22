#!/usr/bin/env node
/**
 * generate-brand-assets.js
 *
 * Single source of truth: assets/logo.svg (or assets/logos/logo.svg)
 *
 * Generates ALL brand assets from the master SVG:
 *   client/public/logo.png           (512x512)
 *   client/public/logo.svg           (copy of the SVG for vector use)
 *   client/public/favicon.ico        (multi-size: 16, 32, 48 packed as PNG)
 *   client/public/favicon-16x16.png  (16x16)
 *   client/public/favicon-32x32.png  (32x32)
 *   client/public/apple-touch-icon.png (180x180)
 *   client/public/icon-192.png       (192x192 — PWA manifest)
 *   client/public/icon-512.png       (512x512 — PWA manifest)
 *   client/public/og-image.png       (1200x630 — logo centered on brand bg)
 *
 * Brand color for OG image background is read from:
 *   - brand.json (colors.primary)
 *   - .env (BRAND_PRIMARY_COLOR)
 *   - Falls back to #6366f1 (indigo)
 *
 * Usage:
 *   node scripts/generate-brand-assets.js
 *   npm run generate-assets
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'client/public');

// Find the SVG source — try assets/logo.svg first, then assets/logos/logo.svg
function findSvgSource() {
  const candidates = [
    path.join(root, 'assets/logo.svg'),
    path.join(root, 'assets/logos/logo.svg'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Read brand color from brand.json or .env
function getBrandColor() {
  // Try brand.json
  try {
    const brandPath = path.join(root, 'brand.json');
    const brand = JSON.parse(fs.readFileSync(brandPath, 'utf8'));
    if (brand.colors && brand.colors.primary) return brand.colors.primary;
    if (brand.icon_color) return brand.icon_color;
  } catch {}

  // Try .env
  try {
    const envPath = path.join(root, '.env');
    const env = fs.readFileSync(envPath, 'utf8');
    const match = env.match(/BRAND_PRIMARY_COLOR=["']?([^"'\s\n]+)/);
    if (match) return match[1];
  } catch {}

  return '#6366f1'; // default indigo
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/**
 * Build a minimal ICO file from an array of PNG buffers.
 */
function buildIco(pngBuffers, sizes) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = pngBuffers.length;
  let dataOffset = headerSize + dirEntrySize * numImages;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(numImages, 4);

  const dirEntries = [];
  for (let i = 0; i < numImages; i++) {
    const png = pngBuffers[i];
    const size = sizes[i];
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dirEntries.push(entry);
    dataOffset += png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

async function main() {
  const svgSource = findSvgSource();
  if (!svgSource) {
    console.error('ERROR: No logo SVG found. Expected assets/logo.svg or assets/logos/logo.svg');
    process.exit(1);
  }

  fs.mkdirSync(publicDir, { recursive: true });

  const svgBuffer = fs.readFileSync(svgSource);
  const brandColor = getBrandColor();
  const brandRgb = hexToRgb(brandColor);
  const relSource = path.relative(root, svgSource);

  console.log('');
  console.log('Brand Asset Generator — Single Source of Truth');
  console.log('================================================');
  console.log('Source:      ' + relSource);
  console.log('Brand color: ' + brandColor);
  console.log('Output:      client/public/');
  console.log('');

  const bg = { r: 0, g: 0, b: 0, alpha: 0 };

  // 1. logo.png (512x512)
  const logo512 = await sharp(svgBuffer, { density: 300 })
    .resize(512, 512, { fit: 'contain', background: bg })
    .png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'logo.png'), logo512);
  console.log('  OK logo.png (512x512)');

  // 2. logo.svg (vector copy)
  fs.copyFileSync(svgSource, path.join(publicDir, 'logo.svg'));
  console.log('  OK logo.svg (vector copy)');

  // 3-4. Favicon PNGs
  const sizes = [16, 32];
  for (const s of sizes) {
    const buf = await sharp(svgBuffer, { density: 300 })
      .resize(s, s, { fit: 'contain', background: bg })
      .png().toBuffer();
    fs.writeFileSync(path.join(publicDir, `favicon-${s}x${s}.png`), buf);
    console.log(`  OK favicon-${s}x${s}.png`);
  }

  // 5. favicon.ico (multi-size)
  const ico16 = await sharp(svgBuffer, { density: 300 }).resize(16, 16, { fit: 'contain', background: bg }).png().toBuffer();
  const ico32 = await sharp(svgBuffer, { density: 300 }).resize(32, 32, { fit: 'contain', background: bg }).png().toBuffer();
  const ico48 = await sharp(svgBuffer, { density: 300 }).resize(48, 48, { fit: 'contain', background: bg }).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), buildIco([ico16, ico32, ico48], [16, 32, 48]));
  console.log('  OK favicon.ico (16+32+48)');

  // 6. apple-touch-icon.png (180x180)
  const apple = await sharp(svgBuffer, { density: 300 })
    .resize(180, 180, { fit: 'contain', background: bg })
    .png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), apple);
  console.log('  OK apple-touch-icon.png (180x180)');

  // 7. icon-192.png (PWA)
  const icon192 = await sharp(svgBuffer, { density: 300 })
    .resize(192, 192, { fit: 'contain', background: bg })
    .png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
  console.log('  OK icon-192.png (192x192)');

  // 8. icon-512.png (PWA)
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), logo512);
  console.log('  OK icon-512.png (512x512)');

  // 9. og-image.png (1200x630, logo centered on brand color)
  const ogW = 1200, ogH = 630, logoSize = 280;
  const logoForOg = await sharp(svgBuffer, { density: 300 })
    .resize(logoSize, logoSize, { fit: 'contain', background: bg })
    .png().toBuffer();
  const ogImage = await sharp({
    create: { width: ogW, height: ogH, channels: 4, background: { ...brandRgb, alpha: 1 } },
  }).composite([{
    input: logoForOg,
    left: Math.round((ogW - logoSize) / 2),
    top: Math.round((ogH - logoSize) / 2),
  }]).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'og-image.png'), ogImage);
  console.log('  OK og-image.png (1200x630)');

  console.log('');
  console.log('All brand assets generated from ' + relSource);
}

main().catch(function (err) {
  console.error('FATAL:', err.message);
  process.exit(1);
});
