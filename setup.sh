#!/usr/bin/env bash
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 20+ is required' >&2; exit 1
fi
major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$major" -lt 20 ]; then echo 'Node.js 20+ is required' >&2; exit 1; fi
npm ci --no-audit --no-fund
npx playwright install chromium
node doctor.mjs
echo 'Installation verified.'
