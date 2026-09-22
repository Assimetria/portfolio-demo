#!/usr/bin/env node
/**
 * generate-og-thumbnails.js — Unified OG thumbnail generator
 * Generates 5 versions (1200x630) from brand.json + logo.png via HTML→Puppeteer→PNG
 * Usage:
 *   node scripts/generate-og-thumbnails.js          # Generate all 5
 *   node scripts/generate-og-thumbnails.js --use v2  # Generate all + set v2 as og-image.png
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const BRAND_PATH = path.join(ROOT, 'brand.json');
const LOGO_PATH = path.join(ROOT, 'client', 'public', 'logo.png');
const OUT_DIR = path.join(ROOT, 'client', 'public');

// Parse --use flag
const useArg = process.argv.find(a => a.startsWith('--use'));
const useIdx = process.argv.indexOf('--use');
const selectedVersion = useIdx !== -1 ? process.argv[useIdx + 1]?.replace('v', '') : null;

async function main() {
  // Load brand
  const brand = JSON.parse(fs.readFileSync(BRAND_PATH, 'utf8'));
  const {
    companyName, tagline, primaryColor, backgroundColor, accentColor,
    surfaceColor, textColor, textSecondaryColor, features, url
  } = brand;
  const domain = (brand.domain || url || '').replace(/https?:\/\//, '');
  const category = brand.category || brand.description?.split('.')[0] || '';

  // Load logo as base64
  const logoBase64 = fs.readFileSync(LOGO_PATH).toString('base64');
  const logoDataUrl = `data:image/png;base64,${logoBase64}`;

  // Feature stats for V1
  const stats = brand.stats || (features || []).slice(0, 4).map(f => ({
    label: f.title, value: f.icon
  }));

  const templates = {
    1: buildV1(companyName, tagline, domain, primaryColor, backgroundColor, accentColor, surfaceColor, textColor, textSecondaryColor, logoDataUrl, stats),
    2: buildV2(companyName, tagline, domain, primaryColor, backgroundColor, accentColor, surfaceColor, textColor, textSecondaryColor, logoDataUrl, category),
    3: buildV3(companyName, tagline, domain, primaryColor, backgroundColor, accentColor, surfaceColor, textColor, textSecondaryColor, logoDataUrl),
    4: buildV4(companyName, tagline, domain, primaryColor, backgroundColor, accentColor, surfaceColor, textColor, textSecondaryColor, logoDataUrl),
    5: buildV5(companyName, tagline, domain, primaryColor, backgroundColor, accentColor, surfaceColor, textColor, textSecondaryColor, logoDataUrl),
  };

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  for (const [ver, html] of Object.entries(templates)) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const outPath = path.join(OUT_DIR, `og-v${ver}.png`);
    await page.screenshot({ path: outPath, type: 'png' });
    await page.close();
    console.log(`✅ Generated og-v${ver}.png`);
  }

  // Copy selected version (or default v2) to og-image.png
  const pick = selectedVersion || '2';
  const src = path.join(OUT_DIR, `og-v${pick}.png`);
  const dest = path.join(OUT_DIR, 'og-image.png');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✅ og-v${pick}.png → og-image.png`);
  }

  await browser.close();
  console.log('Done! All 5 OG thumbnails generated.');
}

// ─── SHARED ────────────────────────────────────────────────────────────────
function baseStyle(bg) {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1200px; height: 630px; overflow: hidden;
      font-family: 'Inter', system-ui, sans-serif;
      background: ${bg};
      color: #fafafa;
    }
  `;
}

// ─── V1: Gradient + Stats ──────────────────────────────────────────────────
function buildV1(name, tagline, domain, primary, bg, accent, surface, text, textSec, logo, stats) {
  const statsHTML = (stats || []).slice(0, 4).map(s => `
    <div style="text-align:center;">
      <div style="font-size:24px;font-weight:800;color:${primary};">${s.value || s.label}</div>
      <div style="font-size:13px;color:${textSec};margin-top:4px;">${s.label || ''}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html><html><head><style>
    ${baseStyle(`linear-gradient(135deg, ${bg} 0%, #1a1a2e 50%, ${bg} 100%)`)}
    .top-line { position:absolute;top:0;left:0;right:0;height:4px;background:${primary}; }
    .container { display:flex;align-items:center;padding:60px 80px 0;height:500px; }
    .logo { width:200px;height:200px;object-fit:contain;flex-shrink:0; }
    .text { margin-left:60px; }
    .name { font-size:56px;font-weight:800;line-height:1.1;color:${text}; }
    .tag { font-size:22px;color:${textSec};margin-top:16px;font-weight:400; }
    .stats-bar {
      position:absolute;bottom:0;left:0;right:0;height:130px;
      background:${surface};border-top:1px solid rgba(255,255,255,0.06);
      display:flex;align-items:center;justify-content:space-around;padding:0 80px;
    }
  </style></head><body>
    <div class="top-line"></div>
    <div class="container">
      <img src="${logo}" class="logo" />
      <div class="text">
        <div class="name">${name}</div>
        <div class="tag">${tagline}</div>
      </div>
    </div>
    <div class="stats-bar">${statsHTML}</div>
  </body></html>`;
}

// ─── V2: Card/Glass (Rui's favorite) ───────────────────────────────────────
function buildV2(name, tagline, domain, primary, bg, accent, surface, text, textSec, logo, category) {
  return `<!DOCTYPE html><html><head><style>
    ${baseStyle(bg)}
    body {
      display:flex;align-items:center;justify-content:center;
      background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 24px 24px;
    }
    .card {
      width:700px;padding:48px 56px;text-align:center;
      background:rgba(255,255,255,0.04);
      border:1.5px solid ${primary}44;
      border-radius:24px;
      box-shadow: 0 0 60px ${primary}18, 0 0 120px ${primary}08;
      backdrop-filter: blur(12px);
    }
    .badge {
      display:inline-block;padding:6px 18px;border-radius:20px;
      background:${primary}18;color:${primary};font-size:13px;font-weight:600;
      letter-spacing:0.5px;text-transform:uppercase;margin-bottom:24px;
    }
    .logo { width:150px;height:150px;object-fit:contain;margin-bottom:20px; }
    .name { font-size:44px;font-weight:800;color:${text};line-height:1.15; }
    .tag { font-size:18px;color:${textSec};margin-top:12px; }
    .domain { font-size:14px;color:${textSec};margin-top:20px;opacity:0.7; }
  </style></head><body>
    <div class="card">
      ${category ? `<div class="badge">${category}</div><br>` : ''}
      <img src="${logo}" class="logo" /><br>
      <div class="name">${name}</div>
      <div class="tag">${tagline}</div>
      <div class="domain">${domain}</div>
    </div>
  </body></html>`;
}

// ─── V3: Bold Hero ─────────────────────────────────────────────────────────
function buildV3(name, tagline, domain, primary, bg, accent, surface, text, textSec, logo) {
  return `<!DOCTYPE html><html><head><style>
    ${baseStyle(`linear-gradient(135deg, ${primary} 0%, ${bg} 60%, ${bg} 100%)`)}
    .wrap { display:flex;align-items:center;justify-content:center;height:100%;padding:0 80px;position:relative; }
    .logo { width:180px;height:180px;object-fit:contain;flex-shrink:0; }
    .text { margin-left:50px; }
    .name {
      font-size:60px;font-weight:900;color:${text};line-height:1.1;
      text-shadow: 0 4px 30px rgba(0,0,0,0.5);
    }
    .tag { font-size:22px;color:rgba(255,255,255,0.8);margin-top:14px;font-weight:400; }
    /* Geometric accents */
    .dots {
      position:absolute;top:40px;right:60px;
      display:grid;grid-template-columns:repeat(5,1fr);gap:8px;
    }
    .dot { width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.15); }
    .line1 {
      position:absolute;top:60px;left:60px;width:60px;height:3px;
      background:rgba(255,255,255,0.2);border-radius:2px;
    }
    .line2 {
      position:absolute;top:76px;left:60px;width:30px;height:3px;
      background:rgba(255,255,255,0.12);border-radius:2px;
    }
    .accent-bar {
      position:absolute;bottom:0;left:0;right:0;height:6px;
      background:linear-gradient(90deg, ${accent}, ${primary});
    }
  </style></head><body>
    <div class="wrap">
      <div class="line1"></div>
      <div class="line2"></div>
      <img src="${logo}" class="logo" />
      <div class="text">
        <div class="name">${name}</div>
        <div class="tag">${tagline}</div>
      </div>
      <div class="dots">${'<div class="dot"></div>'.repeat(15)}</div>
    </div>
    <div class="accent-bar"></div>
  </body></html>`;
}

// ─── V4: Minimal ───────────────────────────────────────────────────────────
function buildV4(name, tagline, domain, primary, bg, accent, surface, text, textSec, logo) {
  return `<!DOCTYPE html><html><head><style>
    ${baseStyle('#0f0f11')}
    body { display:flex;flex-direction:column;align-items:center;justify-content:center; }
    .logo { width:250px;height:250px;object-fit:contain; }
    .name { font-size:48px;font-weight:700;color:${text};margin-top:28px; }
    .tag { font-size:18px;color:${textSec};margin-top:12px;opacity:0.6; }
  </style></head><body>
    <img src="${logo}" class="logo" />
    <div class="name">${name}</div>
    <div class="tag">${tagline}</div>
  </body></html>`;
}

// ─── V5: Split Layout ──────────────────────────────────────────────────────
function buildV5(name, tagline, domain, primary, bg, accent, surface, text, textSec, logo) {
  return `<!DOCTYPE html><html><head><style>
    ${baseStyle(bg)}
    body { display:flex; }
    .left {
      width:480px;height:630px;
      background:linear-gradient(160deg, ${primary}, ${primary}99);
      display:flex;align-items:center;justify-content:center;
      position:relative;
    }
    .left img { width:200px;height:200px;object-fit:contain; }
    .divider {
      width:2px;height:630px;background:rgba(255,255,255,0.08);
    }
    .right {
      flex:1;display:flex;flex-direction:column;justify-content:center;
      padding:60px;
    }
    .name { font-size:46px;font-weight:800;color:${text};line-height:1.15; }
    .tag { font-size:20px;color:${textSec};margin-top:16px; }
    .domain { font-size:14px;color:${textSec};margin-top:28px;opacity:0.6; }
  </style></head><body>
    <div class="left">
      <img src="${logo}" />
    </div>
    <div class="divider"></div>
    <div class="right">
      <div class="name">${name}</div>
      <div class="tag">${tagline}</div>
      <div class="domain">${domain}</div>
    </div>
  </body></html>`;
}

main().catch(err => { console.error(err); process.exit(1); });
