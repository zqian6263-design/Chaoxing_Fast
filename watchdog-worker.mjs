#!/usr/bin/env node
/* Persist a worker exit status: Windows PowerShell 5.1 Start-Process -PassThru
   can return a Process object with a null ExitCode even after WaitForExit. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const entry = process.argv[2] || 'start.mjs';
const exitPath = path.join(root, '.watchdog-last-exit');
const stdout = fs.openSync(path.join(root, 'watch_run.log'), 'a');
const stderr = fs.openSync(path.join(root, 'watch_run_err.log'), 'a');
let handled = false;
function finish(code) {
  if (handled) return;
  handled = true;
  const n = Number.isInteger(code) ? code : 1;
  try { fs.writeFileSync(exitPath, String(n), 'utf8'); }
  finally { process.exit(n); }
}
const child = spawn(process.execPath, [path.join(root, entry), '--headless', '--no-open'], {
  cwd: root, stdio: ['ignore', stdout, stderr], windowsHide: true,
});
child.on('error', () => finish(1));
child.on('exit', code => finish(code));
process.on('SIGTERM', () => child.kill());
