import test from 'node:test';
import assert from 'node:assert/strict';
import { isBrowserClosedError, getPlaybackPage } from '../src/browser-recovery.mjs';


test('single playback tab is reused between consecutive video tasks',async()=>{
  let created=0;
  let closed=false;
  const tab={isClosed:()=>closed};
  const context={
    pages:()=>created?[tab]:[],
    newPage:async()=>{created++;return tab;},
  };
  const first=await getPlaybackPage(context);
  const second=await getPlaybackPage(context,first);
  const third=await getPlaybackPage(context);
  assert.strictEqual(first,second);
  assert.strictEqual(second,third);
  assert.equal(created,1);
  closed=true;
  let replacementCreated=false;
  const context2={pages:()=>[tab],newPage:async()=>{replacementCreated=true;return {isClosed:()=>false};}};
  const newTab=await getPlaybackPage(context2,tab);
  assert.ok(replacementCreated);
  assert.notStrictEqual(newTab,tab);
});

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
