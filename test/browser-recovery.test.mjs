import test from 'node:test';
import assert from 'node:assert/strict';
import { isBrowserClosedError } from '../src/browser-recovery.mjs';

test('recovery only classifies closed Chromium contexts', () => {
  for (const error of [
    new Error('browserContext.newPage: Target page, context or browser has been closed'),
    new Error('TargetClosedError: Target page, context or browser has been closed'),
    new Error('Browser has been closed'),
  ]) assert.equal(isBrowserClosedError(error), true);
  for (const error of [
    new Error('Navigation timeout of 60000ms exceeded'),
    new Error('HTTP 403'),
    new Error('net::ERR_CONNECTION_RESET'),
    new Error('User pressed pause'),
  ]) assert.equal(isBrowserClosedError(error), false);
  assert.equal(isBrowserClosedError(null), false);
});
