#!/usr/bin/env node
/* Deterministic installer; never report success after a failed step. */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, '.runtime', 'browsers');
process.env.npm_config_cache ||= path.join(root, '.runtime', 'npm-cache');

const major = Number(process.versions.node.split('.')[0]);
if (!Number.isFinite(major) || major < 20) {
  console.error('Node.js 20+ is required (detected ' + process.version + ').');
  process.exit(1);
}
const steps = [
  ['Install locked dependencies', 'npm ci --no-audit --no-fund'],
  ['Install matching Chromium', 'npx playwright install chromium'],
  ['Validate deployment', 'node doctor.mjs'],
];
for (const [label, command] of steps) {
  console.log('==> ' + label);
  try { execSync(command, { stdio: 'inherit' }); }
  catch (error) {
    console.error('FAILED: ' + label + '. See output above. Exit=' + (error.status ?? 'unknown'));
    process.exit(1);
  }
}
console.log('==> Installation successful. Run: node doctor.mjs');
