#!/usr/bin/env node
/* src/chaoxing_auto.mjs —— 接口模式（适用于允许“秒完成”的课程）
   用法：node src/chaoxing_auto.mjs --url "<课程URL>" [参数] */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { info, ok, warn, err, sleep, rand, readCookieFile, cookieHeader, cookieValue, hasSession, courseFromUrl, readConfig, writeConfig, httpGet, ROOT } from './common.mjs';
import { decodeCoursePoint, decodeCourseCard, calcEnc } from './parse.mjs';

const USAGE = `
接口模式（可能被“需真实播放”的课程拒绝，此时请改用 chaoxing_watch.mjs）
用法: node src/chaoxing_auto.mjs --url "<课程URL>" [--list] [--pace instant|fast]
`.trim();

function parseArgs(argv) {
  const o = { url: null, list: false, pace: 'fast', instant: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => (i + 1 < argv.length ? argv[++i] : null);
    if (a === '--url') o.url = next();
    else if (a === '--list') o.list = true;
    else if (a === '--pace') o.pace = next();
    else if (a === '--no-instant') o.instant = false;
    else if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
  }
  return o;
}

const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex');

function resolveRt(job) {
  if (job.rt) return job.rt;
  const m = /-rt_([1d])/.exec(job.otherinfo || '');
  if (m) return m[1] === 'd' ? '0.9' : '1';
  return '';
}

async function reportProgress(course, job, info, dtoken, duration, playingTime, userid, cookie, { dtype = 'Video', isdrag = 3, rt } = {}) {
  const extra = {};
  if (job.videoFaceCaptureEnc) extra.videoFaceCaptureEnc = job.videoFaceCaptureEnc;
  if (job.attDuration) extra.attDuration = job.attDuration;
  if (job.attDurationEnc) extra.attDurationEnc = job.attDurationEnc;
  const enc = calcEnc(course.clazzId, userid, job.jobid, job.objectid, playingTime, duration);
  const params = { clazzId: course.clazzId, playingTime, duration, clipTime: `0_${duration}`, objectId: job.objectid, otherInfo: job.otherinfo, courseId: course.courseId, jobid: job.jobid, userid, isdrag, view: 'pc', enc, dtype, rt, _t: Date.now(), ...extra };
  const r = await httpGet(`https://mooc1.chaoxing.com/mooc-ans/multimedia/log/a/${course.cpi}/${dtoken}`, params, cookie, 'https://mooc1.chaoxing.com/ananas/modules/video/index.html?v=2025-0725-1842');
  const blocked = r.status === 403 || /验证码|validate/i.test(r.text);
  let passed = false;
  try { passed = !!JSON.parse(r.text).isPassed; } catch { passed = /"isPassed"\s*:\s*true/i.test(r.text); }
  return { passed, status: r.status, blocked };
}

async function getVideoMeta(course, job, cookie) {
  const r = await httpGet(`https://mooc1.chaoxing.com/ananas/status/${job.objectid}`, { k: cookieValue(readCookieFile(), 'fid') || 1024, flag: 'normal' }, cookie, 'https://mooc1.chaoxing.com/ananas/modules/video/index.html?v=2025-0725-1842');
  let d = {}; try { d = JSON.parse(r.text); } catch {}
  return d.status === 'success' ? { dtoken: d.dtoken, duration: parseInt(d.duration, 10) || 0 } : null;
}

async function buildPlan(course, cookie) {
  const stu = await httpGet('https://mooc2-ans.chaoxing.com/mooc2-ans/mycourse/studentcourse', { courseid: course.courseId, clazzid: course.clazzId, cpi: course.cpi, ut: 's' }, cookie);
  const points = decodeCoursePoint(stu.text);
  const plan = [];
  for (const p of points) {
    if (p.has_finished) { plan.push({ point: p, jobs: [], finished: true }); continue; }
    let jobs = [], notOpen = false;
    for (const num of '0123456') {
      const r = await httpGet('https://mooc1.chaoxing.com/mooc-ans/knowledge/cards', { clazzid: course.clazzId, courseid: course.courseId, knowledgeid: p.id, ut: 's', cpi: course.cpi, v: '2025-0424-1038-3', mooc2: 1, num }, cookie);
      const d = decodeCourseCard(r.text);
      if (d.notOpen) { notOpen = true; break; }
      for (const j of d.jobs) j.num = num;
      jobs = jobs.concat(d.jobs);
      if (jobs.length && num >= '2') break;
      await sleep(rand(60, 150));
    }
    plan.push({ point: p, jobs, notOpen });
  }
  return plan;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cookies = readCookieFile(); const cookie = cookieHeader(cookies);
  if (!hasSession(cookies)) { err('未登录，请先运行：node src/login.mjs'); process.exit(1); }
  let course = opts.url ? courseFromUrl(opts.url) : null;
  if (!course) { course = readConfig().course || null; if (!course) { err('请提供 --url'); process.exit(1); } }
  if (opts.url) writeConfig({ ...readConfig(), course: { ...course, url: opts.url } });
  const userid = cookieValue(cookies, '_uid') || cookieValue(cookies, 'UID');
  info(`课程 courseId=${course.courseId} clazzId=${course.clazzId} cpi=${course.cpi}`);
  const plan = await buildPlan(course, cookie);
  const vids = []; for (const { point, jobs } of plan) for (const j of jobs) if (j.type === 'video') vids.push({ point, job: j });
  info(`共 ${vids.length} 个视频任务`);
  if (opts.list) { vids.forEach((v, i) => console.log(`${i + 1}. ${v.point.title} | ${v.job.name} | ${v.job.attDuration}s`)); return; }

  let done = 0, watch = 0, skipped = 0, failed = 0;
  for (const { point, job } of vids) {
    const meta = await getVideoMeta(course, job, cookie);
    if (!meta) { warn(`[${job.name}] 获取视频信息失败，跳过`); skipped++; continue; }
    const rt = resolveRt(job) || '0.9';
    if (opts.instant) {
      const r = await reportProgress(course, job, {}, meta.dtoken, meta.duration, meta.duration, userid, cookie, { dtype: 'Video', isdrag: 4, rt });
      if (r.passed) { ok(`[${job.name}] 秒完成`); done++; continue; }
      if (r.blocked) { warn(`[${job.name}] 被拦截`); }
    }
    const c = await reportProgress(course, job, {}, meta.dtoken, meta.duration, meta.duration, userid, cookie, { dtype: 'Video', isdrag: 3, rt });
    if (c.passed) { ok(`[${job.name}] 完成`); done++; }
    else { warn(`[${job.name}] 未通过（需真实播放），请改用 chaoxing_watch.mjs`); watch++; }
    await sleep(rand(1500, 4000));
  }
  console.log('\n===== 接口模式汇总 =====');
  ok(`完成: ${done}`); warn(`需真实播放(改用 watch): ${watch}`); warn(`跳过: ${skipped}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.url.replace('file://', '')) main().catch((e) => { err(`运行出错: ${e.stack || e.message}`); process.exit(1); });
