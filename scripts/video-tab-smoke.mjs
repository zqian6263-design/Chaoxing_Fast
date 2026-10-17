import '../src/runtime.mjs';
import {chromium} from 'playwright';
import {getPlaybackPage} from '../src/browser-recovery.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const profile=await fs.mkdtemp(path.join(os.tmpdir(),'cx-single-tab-'));
let ctx;
try{
  ctx=await chromium.launchPersistentContext(profile,{headless:true});
  const p=await getPlaybackPage(ctx);
  const initial=ctx.pages().length;
  await p.goto('data:text/html,<h1>Lesson 1</h1>');
  const p2=await getPlaybackPage(ctx,p);
  await p2.goto('data:text/html,<h1>Lesson 2</h1>');
  if(p!==p2)throw new Error('New page allocated');
  const current=ctx.pages().length;
  if(initial!==current)throw new Error('Tab count changed: '+initial+' -> '+current);
  if(await p.locator('h1').innerText()!=='Lesson 2')throw new Error('Navigation did not update original page');
  console.log('REUSE_VIDEO_TAB=PASS');
  console.log('PAGES_BETWEEN_TASKS='+initial+' -> '+current);
  console.log('SAME_PAGE_OBJECT=true');
} finally {
  if(ctx)await ctx.close().catch(()=>{});
  await fs.rm(profile,{recursive:true,force:true,maxRetries:2}).catch(()=>{});
}
