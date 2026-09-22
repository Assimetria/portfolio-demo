#!/usr/bin/env node
/**
 * prebuild.js — Orchestrator for all prebuild scripts
 *
 * Runs automatically before every build (via package.json "prebuild" hook).
 * Executes:
 *   1. scripts/apply-brand.js — brand.json → brand.css + brand.js + design.js
 *   2. scripts/@custom/prebuild.js — product-specific prebuild (optional)
 *
 * Products can add their own prebuild steps in scripts/@custom/prebuild.js
 * without modifying this file.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const scripts = [
  // System scripts — always run
  { name: 'apply-brand', path: 'scripts/apply-brand.js', required: true },
];

// Discover optional system scripts that should run at prebuild
const optionalSystemScripts = [
  { name: 'generate-barrels', path: 'scripts/@system/generate-barrels.js' },
  // sharp-dependent scripts removed (not available in Docker build)
];

for (const s of optionalSystemScripts) {
  if (fs.existsSync(path.join(root, s.path))) {
    scripts.push({ name: s.name, path: s.path, required: false });
  }
}

// Custom prebuild hook — product-specific
const customPrebuild = 'scripts/@custom/prebuild.js';
if (fs.existsSync(path.join(root, customPrebuild))) {
  scripts.push({ name: 'custom-prebuild', path: customPrebuild, required: false });
}

console.log(`\n━━━ prebuild.js — running ${scripts.length} scripts ━━━\n`);

let failures = 0;

for (const script of scripts) {
  const fullPath = path.join(root, script.path);
  if (!fs.existsSync(fullPath)) {
    if (script.required) {
      console.error(`FATAL: Required script not found: ${script.path}`);
      process.exit(1);
    }
    console.log(`  skip: ${script.name} (not found)`);
    continue;
  }

  console.log(`  run: ${script.name} (${script.path})`);
  try {
    // Pass --use v2 arg for og-thumbnails if needed
    const args = script.name === 'generate-og-thumbnails' ? ' --use v2' : '';
    execSync(`node ${script.path}${args}`, {
      cwd: root,
      stdio: 'inherit',
      timeout: 60000,
    });
    console.log(`  ✓ ${script.name} done\n`);
  } catch (err) {
    if (script.required) {
      console.error(`FATAL: ${script.name} failed:`, err.message);
      process.exit(1);
    }
    console.warn(`  ⚠ ${script.name} failed (non-critical):`, err.message);
    failures++;
  }
}

console.log(`━━━ prebuild complete (${scripts.length - failures}/${scripts.length} succeeded) ━━━\n`);
