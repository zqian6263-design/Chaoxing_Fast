#!/usr/bin/env node
/* Offline-first deployment checks. Never print credentials or Cookie values. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, '.runtime', 'browsers');
const results = [];
function add(name, ok, required, detail) {
  results.push({ name, ok: Boolean(ok), required: Boolean(required), detail });
}
const major = Number(process.versions.node.split('.')[0]);
add('node', major >= 20, true, process.version + ' (minimum v20)');
add('lockfile', fs.existsSync(path.join(root, 'package-lock.json')), true, 'package-lock.json');
let playwright;
try { playwright = require('playwright'); add('playwright', true, true, 'Installed'); }
catch { add('playwright', false, true, 'Run node setup.mjs'); }
if (playwright) {
  const browserPath = playwright.chromium.executablePath();
  add('chromium', fs.existsSync(browserPath), true, fs.existsSync(browserPath) ? 'Installed' : 'Run npx playwright install chromium');
}
const cfgPath = path.join(root, 'config.json');
if (fs.existsSync(cfgPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    add('config', data && typeof data === 'object' && !Array.isArray(data), true, 'JSON format');
  } catch { add('config', false, true, 'Invalid JSON'); }
} else add('config', true, false, 'Not configured yet');
add('session', fs.existsSync(path.join(root, 'cookies.json')), false, 'Presence only; no credential values inspected');
if (process.argv.includes('--json')) console.log(JSON.stringify({ success: results.every(c => !c.required || c.ok), checks: results }, null, 2));
else for (const c of results) console.log((c.ok ? 'PASS' : c.required ? 'FAIL' : 'INFO') + ' ' + c.name + ': ' + c.detail);
if (results.some(c => c.required && !c.ok)) process.exitCode = 1;
