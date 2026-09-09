#!/usr/bin/env node
/* src/chaoxing_watch.mjs —— 真实播放模式（通用版）
   用法：node src/chaoxing_watch.mjs --url "<课程URL>" [参数]
        或先 node start.mjs 选择课程后自动运行。 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import {
  info, ok, warn, err, sleep, rand,
  readCookieFile, cookieHeader, hasSession, courseFromUrl,
  readConfig, writeConfig, httpGet, listCourses, ROOT,
} from './common.mjs';
import { decodeCoursePoint, decodeCourseCard } from './parse.mjs';

const PROFILE = path.join(ROOT, 'browser-profile');

const USAGE = `
真实播放模式（Playwright 自动看视频）
用法: node src/chaoxing_watch.mjs --url "<课程URL>" [选项]

  --url <URL>        课程主页 URL（含 courseid/clazzid/cpi）
  --rate <n>         播放倍速，默认 2
  --ratio <n>        完成所需时长比例，默认 0.91（看到 91% 即完成）
  --limit <n>        只扫描前 n 个知识点
  --start <n>        跳过前 n 个视频（续跑）
  --retry <n>        单个视频失败重试次数（默认 3）
  --scan-concurrency <n>  扫描章节点并发（默认 6）
  --visible / --headless  显示/隐藏浏览器窗口（默认显示）
  --dashboard        开启本地实时进度网页（默认 http://127.0.0.1:7788）
  --port <n>         实时网页端口（默认 7788）
  --list             只列出视频任务
  --list-courses     列出账号下的课程
  -h, --help         帮助
`.trim();

function parseArgs(argv) {
  const o = { url: null, rate: 2, ratio: 0.91, limit: 0, start: 0, visible: true, list: false, listCourses: false, maxSec: 0, dashboard: false, port: 7788, videoRetries: 3, scanConcurrency: 6 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => (i + 1 < argv.length ? argv[++i] : null);
    switch (a) {
      case '-h': case '--help': console.log(USAGE); process.exit(0); break;
      case '--url': o.url = next(); break;
      case '--rate': o.rate = parseFloat(next()); break;
      case '--ratio': o.ratio = Math.min(1, Math.max(0.1, parseFloat(next()))); break;
      case '--limit': o.limit = parseInt(next(), 10); break;
      case '--start': o.start = parseInt(next(), 10); break;
      case '--retry': o.videoRetries = parseInt(next(), 10); break;
      case '--scan-concurrency': o.scanConcurrency = Math.max(1, parseInt(next(), 10)); break;
      case '--visible': o.visible = true; break;
      case '--headless': o.visible = false; break;
      case '--list': o.list = true; break;
      case '--list-courses': o.listCourses = true; break;
      case '--dashboard': o.dashboard = true; break;
      case '--port': o.port = parseInt(next(), 10); break;
      case '--max-sec': o.maxSec = Math.max(0, parseFloat(next())); break;
      default: err(`未知参数: ${a}`); process.exit(1);
    }
  }
  return o;
}

/* —— 实时进度仪表盘 —— */
const DASH = { phase: 'start', paused: false, scanDone: 0, scanTotal: 0, total: 0, done: 0, failed: 0, noPlayer: 0, curIdx: 0, curTitle: '', curName: '', curCt: 0, curDur: 0, log: [], startedAt: new Date().toISOString() };
function dashLog(msg) { DASH.log.push(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${msg}`); if (DASH.log.length > 80) DASH.log.shift(); }
function startDashboard(port) {
  const server = createServer((req, res) => {
    if (req.url === '/api/status') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(DASH)); return; }
    if (req.url.startsWith('/api/control')) { const q = new URL(req.url, 'http://x').searchParams.get('action'); if (q === 'pause') DASH.paused = true; else if (q === 'resume') DASH.paused = false; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ paused: DASH.paused })); return; }
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(DASH_HTML); return; }
    res.writeHead(404); res.end('Not Found');
  });
  server.listen(port, '127.0.0.1', () => info(`实时进度网页已开启: http://127.0.0.1:${port}`));
}
const DASH_HTML = `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>刷课实时进度</title><style>
 body{font-family:system-ui,Segoe UI,Microsoft YaHei,sans-serif;background:#f6f7f9;color:#1a202c;margin:0;padding:24px}
 .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
 h1{font-size:22px;margin:0 0 2px}.sub{color:#6b7280;font-size:13px}
 .badge{display:inline-block;padding:2px 12px;border-radius:999px;font-size:13px;background:#eef2ff;color:#3730a3}
 .badge.scan{background:#eef2ff;color:#3730a3}.badge.watch{background:#e0f2fe;color:#075985}.badge.done{background:#dcfce7;color:#14532d}
 button{float:right;background:#1d4ed8;border:none;color:#fff;padding:6px 14px;border-radius:8px;font-size:14px;cursor:pointer}
 button:hover{background:#1e40af}
 .big{font-size:42px;font-weight:700}.lb{color:#6b7280;font-size:13px;margin:6px 0}
 .bar{height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-top:8px}
 .fill{height:100%;background:#2563eb;transform-origin:left;transition:transform .5s}
 .mid{display:inline-block;margin-left:12px;font-size:14px;color:#6b7280}
 #lines{font-family:ui-monospace,Consolas,monospace;font-size:13px;line-height:1.6;max-height:340px;overflow:auto;color:#374151}
 .line{margin:0;white-space:pre-wrap}
</style></head><body><h1>超星刷课 · 实时进度</h1><div class="sub" id="sub">真实播放，看到 91% 即完成</div>
<div class="card"><span id="phase" class="badge">启动中</span><button id="btnpause" onclick="toggle()">⏸ 暂停</button><div style="margin-top:14px"><span class="lb">已完成视频</span> <span id="done" class="big">0</span> / <span id="total">0</span><span class="mid" id="meta"></span><div class="bar"><div id="fill" class="fill" style="transform:scaleX(0)"></div></div></div></div>
<div class="card"><div class="lb">当前播放</div><div id="cur" style="font-size:18px;font-weight:600">-</div><div class="lb">本条进度</div><div id="pct" style="font-size:26px;font-weight:700">0%</div><div class="bar"><div id="fill2" class="fill" style="transform:scaleX(0)"></div></div></div>
<div class="card"><div class="lb">最近日志</div><div id="lines"></div></div>
<script>
 var paused=false;async function toggle(){var a=paused?'resume':'pause';await fetch('/api/control?action='+a);}
 function updatePause(p){paused=p;var b=document.getElementById('btnpause');b.textContent=p?'▶ 继续':'⏸ 暂停';}
 async function tick(){try{var d=await (await fetch('/api/status',{cache:'no-store'})).json();updatePause(d.paused);var ph=document.getElementById('phase');ph.className='badge';ph.classList.add(d.phase);ph.textContent=d.phase==='scan'?('扫描任务清单 '+d.scanDone+'/'+d.scanTotal):d.phase==='watch'?('播放中 '+d.done+'/'+d.total):'已完成';document.getElementById('done').textContent=d.done;document.getElementById('total').textContent=d.total;var f=document.getElementById('fill');f.style.transform='scaleX('+(d.total?(d.done/d.total):0)+')';document.getElementById('meta').textContent=(d.noPlayer||d.failed)?('失败 '+d.failed+' / 无播放器 '+d.noPlayer):'';if(d.phase==='scan'){document.getElementById('cur').textContent='正在扫描 '+d.scanDone+'/'+d.scanTotal;}else{document.getElementById('cur').textContent=(d.curIdx?d.curIdx+'/'+d.total+' ': '')+(d.curName||'-')+(d.curTitle?(' · '+d.curTitle):'');}var pct=document.getElementById('pct');pct.textContent=(d.curDur?Math.round(d.curCt/d.curDur*100):0)+'%';document.getElementById('fill2').style.transform='scaleX('+(d.curDur?Math.min(1,d.curCt/d.curDur):0)+')';var lines=document.getElementById('lines');lines.innerHTML='';(d.log||[]).forEach(function(l){var p=document.createElement('div');p.className='line';p.textContent=l;lines.appendChild(p);});lines.scrollTop=lines.scrollHeight;}catch(e){}}
 tick();setInterval(tick,1000);
</script></body></html>`;

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length); let i = 0;
  async function runner() { while (i < items.length) { const idx = i++; results[idx] = await worker(items[idx], idx); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runner()));
  return results;
}

async function buildPlan(course, cookie, pointsLimit, concurrency) {
  info('读取章节列表…');
  const stu = await httpGet('https://mooc2-ans.chaoxing.com/mooc2-ans/mycourse/studentcourse', { courseid: course.courseId, clazzid: course.clazzId, cpi: course.cpi, ut: 's' }, cookie);
  let points = decodeCoursePoint(stu.text);
  if (pointsLimit > 0) points = points.slice(0, pointsLimit);
  const conc = Math.max(1, concurrency || 6);
  info(`共 ${points.length} 个知识点（LIMIT=${pointsLimit || '不限'}, 扫描并发=${conc}）`);
  DASH.phase = 'scan'; DASH.scanTotal = points.length;
  let completed = 0;
  const results = await mapConcurrent(points, conc, async (p) => {
    const res = await (async () => {
      if (p.has_finished) return { point: p, jobs: [], finished: true };
      let jobs = [], notOpen = false;
      for (const num of '0123456') {
        const r = await httpGet('https://mooc1.chaoxing.com/mooc-ans/knowledge/cards', { clazzid: course.clazzId, courseid: course.courseId, knowledgeid: p.id, ut: 's', cpi: course.cpi, v: '2025-0424-1038-3', mooc2: 1, num }, cookie);
        const d = decodeCourseCard(r.text);
        if (d.notOpen) { notOpen = true; break; }
        const newJobs = d.jobs;
        for (const j of newJobs) j.num = num;
        jobs = jobs.concat(newJobs);
        // 已拿到任务、且当前编号没有新任务 → 后面不再有卡片，可停（避免漏掉同一知识点下的多个视频）
        if (jobs.length > 0 && newJobs.length === 0) break;
        await sleep(rand(30, 80));
      }
      return { point: p, jobs, notOpen };
    })();
    completed++; DASH.scanDone = completed;
    if (completed % 30 === 0) info(`扫描知识点进度 ${completed}/${points.length}（当前: ${p.title}）`);
    return res;
  });
  DASH.phase = results.length ? 'watch' : 'done';
  return results;
}

async function findVideoFrame(page, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const f of page.frames()) { try { if (await f.locator('video').count()) return f; } catch {} }
    await sleep(1500);
  }
  return null;
}

async function ensurePlaying(vframe, video, opts) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const st = await video.evaluate((el) => ({ ct: el.currentTime, paused: el.paused, ready: el.readyState })).catch(() => ({ ct: 0, paused: true, ready: 0 }));
    if (!st.paused && st.ct > 0) return;
    await video.evaluate((el, rate) => { el.muted = true; if (rate > 1) el.playbackRate = rate; const p = el.play(); if (p && p.catch) p.catch(() => {}); }, opts.rate).catch(() => {});
    for (const sel of ['.vjs-big-play-button', '.vjs-play-control', 'button[aria-label*="play" i]', '[class*="play-btn"]', '[class*="playButton"]', '.play-btn']) {
      try { const el = vframe.locator(sel).first(); if (await el.count()) { await el.click({ timeout: 1500 }).catch(() => {}); break; } } catch {}
    }
    await sleep(2000);
    const s2 = await video.evaluate((el) => ({ ct: el.currentTime, paused: el.paused })).catch(() => ({ ct: 0, paused: true }));
    if (!s2.paused && s2.ct > 0) return;
  }
}

async function waitDuration(video, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const d = await video.evaluate((el) => (el.duration && isFinite(el.duration) ? el.duration : 0)).catch(() => 0);
    if (d > 0) return d;
    await sleep(1500);
  }
  return 0;
}

async function resolveCourse(o) {
  if (o.url) { const c = courseFromUrl(o.url); if (c) { writeConfig({ ...readConfig(), course: { ...c, url: o.url } }); return c; } else { err('URL 解析不到课程参数'); process.exit(1); } }
  const cfg = readConfig();
  if (cfg.course && cfg.course.courseId) return cfg.course;
  err('未提供 --url 且无已保存课程。请用 --url "<课程URL>" 指定，或先运行 node start.mjs。'); process.exit(1);
}

async function watchVideo(browser, course, point, job, opts) {
  const params = { clazzid: course.clazzId, courseid: course.courseId, knowledgeid: point.id, ut: 's', cpi: course.cpi, v: '2025-0424-1038-3', mooc2: 1, num: (job.num ?? '1') };
  const u = new URL('https://mooc1.chaoxing.com/mooc-ans/knowledge/cards');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const urlStr = u.toString();
  const attempts = opts.videoRetries || 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const page = await browser.newPage();
    let loaded = false;
    for (let g = 0; g < 3; g++) {
      try { await page.goto(urlStr, { waitUntil: 'domcontentloaded', timeout: 60000 }); loaded = true; break; }
      catch (e) { warn(`[${job.name}] 载入失败(${g + 1}/3): ${String(e.message).slice(0, 80)}`); try { await page.close(); } catch {} await sleep(rand(5000, 9000)); }
    }
    if (!loaded) { try { await page.close(); } catch {} continue; }
    await page.waitForTimeout(2500);
    const vframe = await findVideoFrame(page, 90000);
    if (!vframe) { warn(`[${job.name}] 找不到播放器（第 ${attempt} 次）`); try { await page.close(); } catch {} await sleep(rand(4000, 8000)); continue; }
    const video = vframe.locator('video').first();
    await ensurePlaying(vframe, video, opts);
    const dur = await waitDuration(video, 120000);
    info(`[${job.name}] 开始播放 ${dur > 0 ? `${Math.round(dur)}s` : '(时长未知)'} @${opts.rate}x（第 ${attempt} 次）`);
    let lastCt = -1, stalled = 0, lastLogCt = -60, rateTick = 0;
    const check = async () => {
      const st = await video.evaluate((el) => ({ ct: Math.round(el.currentTime), dur: Math.round(el.duration || 0), paused: el.paused, ended: el.ended })).catch(() => ({ ct: 0, dur: 0, paused: true, ended: false }));
      if (st.paused) await ensurePlaying(vframe, video, opts);
      return st;
    };
    const start = Date.now();
    const maxMs = opts.maxSec > 0 ? opts.maxSec * 1000 : (dur > 0 ? (dur * opts.ratio / Math.max(opts.rate, 1)) * 1000 + 120000 : 1000 * 60 * 90);
    while (Date.now() - start < maxMs) {
      await sleep(6000);
      if (DASH.paused) {
        await video.evaluate((el) => el.pause()).catch(() => {});
        warn(`[${job.name}] 已暂停，等待在网页点击「继续」…`);
        while (DASH.paused) await sleep(3000);
        await ensurePlaying(vframe, video, opts);
      }
      const st = await check();
      DASH.curCt = st.ct; if (st.dur > 0) DASH.curDur = st.dur;
      if (st.ended || (st.dur > 0 && st.ct >= st.dur * opts.ratio)) {
        warn(`[${job.name}] 已播放到 ${Math.round(opts.ratio * 100)}%（${st.ct}s/${st.dur}s），等待上报完成…`);
        await sleep(12000); await page.close(); return 'done';
      }
      if (st.ct === lastCt) { stalled++; if (stalled >= 6) { info(`[${job.name}] 进度停滞，重试播放`); await ensurePlaying(vframe, video, opts); stalled = 0; } } else stalled = 0;
      lastCt = st.ct;
      if (++rateTick % 5 === 0 && st.ct > 0) await video.evaluate((el, r) => { el.playbackRate = r; }, Math.max(opts.rate, 1)).catch(() => {});
      if (st.ct > 0 && st.ct - lastLogCt >= 60) { const pct = st.dur > 0 ? Math.round((st.ct / st.dur) * 100) + '%' : '?%'; info(`[${job.name}] 正在播放 ${st.ct}s / ${st.dur || '?'}s (${pct})`); lastLogCt = st.ct; }
    }
    warn(`[${job.name}] 超时未看完（第 ${attempt} 次），重试…`); try { await page.close(); } catch {}
  }
  warn(`[${job.name}] 多次尝试仍失败，跳过`);
  return 'timeout';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cookies = readCookieFile();
  const cookie = cookieHeader(cookies);

  if (opts.listCourses) {
    const cs = await listCourses(cookie);
    if (!cs.length) { err('未能枚举课程，请先登录：node src/login.mjs'); process.exit(1); }
    console.log('账号课程：'); cs.forEach((c, i) => console.log(`  ${i + 1}. courseId=${c.courseId} clazzId=${c.clazzId} cpi=${c.cpi}`));
    return;
  }
  if (!hasSession(cookies)) { err('未登录，请先运行：node src/login.mjs'); process.exit(1); }
  const course = await resolveCourse(opts);

  if (opts.dashboard) startDashboard(opts.port);
  const plan = await buildPlan(course, cookie, opts.limit, opts.scanConcurrency);
  const vids = [];
  for (const { point, jobs, notOpen, finished } of plan) for (const j of jobs) if (j.type === 'video') vids.push({ point, job: j });
  info(`共 ${vids.length} 个视频任务`); DASH.total = vids.length;
  if (opts.list) { vids.forEach((v, i) => console.log(`${i + 1}. ${v.point.title} | ${v.job.name} | ${v.job.attDuration}s`)); return; }
  const slice = vids.slice(opts.start);
  info(`本次处理第 ${opts.start + 1} ~ ${opts.start + slice.length} 个视频（共 ${vids.length} 个）`);

  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !opts.visible, viewport: { width: 1200, height: 800 }, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  await ctx.addCookies(cookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path || '/' })));
  info('扫描完成，稍候 3 秒开始播放…'); await sleep(3000);

  const stat = { done: 0, no_player: 0, timeout: 0 };
  for (let i = 0; i < slice.length; i++) {
    const { point, job } = slice[i];
    if (DASH.paused) { warn('已暂停，等待在网页点击「继续」…'); while (DASH.paused) await sleep(3000); }
    DASH.phase = 'watch'; DASH.curIdx = opts.start + i + 1; DASH.curTitle = point.title; DASH.curName = job.name; DASH.curCt = 0; DASH.curDur = (job.attDuration || 0);
    info(`(${opts.start + i + 1}/${vids.length}) ${point.title} -> ${job.name}`);
    const r = await watchVideo(ctx, course, point, job, opts);
    if (r === 'done') { ok(`完成: ${point.title} / ${job.name}`); stat.done++; DASH.done++; }
    else if (r === 'no_player') { warn('无播放器，跳过'); stat.no_player++; DASH.noPlayer++; }
    else { warn('超时/未完成'); stat.timeout++; DASH.failed++; }
    await sleep(rand(2000, 4000));
  }
  await ctx.close(); DASH.phase = 'done';
  console.log('\n===== Watch 汇总 ====='); ok(`真实播放完成: ${stat.done}`); warn(`无播放器: ${stat.no_player}`); warn(`超时/未完成: ${stat.timeout}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { err(`运行出错: ${e.stack || e.message}`); process.exit(1); });
