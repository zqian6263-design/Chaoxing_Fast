import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function run(file, args) {
  return spawnSync(process.execPath, [path.join(root,file), ...args], {
    encoding: 'utf8', cwd: root, timeout: 10000,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
}
test('launcher help exits without invoking network/login', () => {
  const r = run('start.mjs', ['--help']);
  assert.equal(r.status,0);
  assert.match(r.stdout,/node start\.mjs/);
});
test('watcher help exits without invoking browser/network', () => {
  const r = run('src/chaoxing_watch.mjs', ['--help']);
  assert.equal(r.status,0);
  assert.match(r.stdout,/--list-courses/);
});
test('direct API help invokes its CLI entrypoint on Windows', () => {
  const r = run('src/chaoxing_auto.mjs', ['--help']);
  assert.equal(r.status,0);
  assert.match(r.stdout,/接口模式/);
});
for (const args of [['--rate','nan'],['--ratio','NaN'],['--port','0'],['--start','-1'],['--retry','0'],['--scan-concurrency','999']]) {
  test('launcher rejects invalid numeric arguments: '+args.join(' '), () => {
    const r = run('start.mjs', args);
    assert.notEqual(r.status,0);
    assert.match(r.stdout + r.stderr,/Invalid CLI options/);
  });
}
test('doctor emits well-formed JSON without exposing session values', () => {
  const r = run('doctor.mjs', ['--json']);
  const diagnostic = JSON.parse(r.stdout);
  assert.ok(Array.isArray(diagnostic.checks));
  assert.ok(diagnostic.checks.some(x=>x.name==='node'));
  assert.ok(!r.stdout.includes('password'));
});
