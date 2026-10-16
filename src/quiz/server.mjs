#!/usr/bin/env node
/**
 * Optional localhost-only study tutor server, separate from video dashboard.
 * Never submits quiz answers, automates graded attempts, or sends Chaoxing
 * cookies to AI providers. A key is held in process memory only.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { explainQuiz, DEEPSEEK_MODEL } from './provider.mjs';
import { scanConfiguredCourse } from './scan.mjs';
import { readQuizQuestions } from './reader.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.STUDY_PORT || '7789');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid STUDY_PORT');
const origin = 'http://127.0.0.1:' + port;
const csrf = randomBytes(24).toString('hex');
let apiKey = process.env.DEEPSEEK_API_KEY || '';
let billingAcknowledged = false;
let busy = false;
let scanning = false;
let reading = false;
let requests = 0;
const maxRequests = 20;

const html = fs.readFileSync(path.join(DIR, 'study.html'), 'utf8');
const js = fs.readFileSync(path.join(DIR, 'client.js'), 'utf8');

function headers(res, type, status = 200) {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  });
}
function sendJson(res, status, data) {
  headers(res, 'application/json; charset=utf-8', status);
  res.end(JSON.stringify(data));
}
async function readJson(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json'))
    throw Object.assign(new Error('Only application/json is supported'), { status: 415 });
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString('utf8');
    if (raw.length > 24000) throw Object.assign(new Error('Payload too large'), { status: 413 });
  }
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
function sameOrigin(req) {
  const given = req.headers.origin;
  return (!given || given === origin) &&
    req.headers['x-study-csrf'] === csrf &&
    req.headers.host === '127.0.0.1:' + port;
}

const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== '127.0.0.1:' + port) {
      sendJson(res, 403, { error: 'Host rejected' }); return;
    }
    const url = new URL(req.url, origin);
    if (req.method === 'GET' && url.pathname === '/') {
      headers(res, 'text/html; charset=utf-8');
      res.end(html.replace('%%CSRF_TOKEN%%', csrf)); return;
    }
    if (req.method === 'GET' && url.pathname === '/client.js') {
      headers(res, 'text/javascript; charset=utf-8'); res.end(js); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, { ok: true, provider: 'DeepSeek',
        model: DEEPSEEK_MODEL, keyConfigured: Boolean(apiKey), enabled: Boolean(apiKey && billingAcknowledged),
        environmentKeyAvailable: Boolean(process.env.DEEPSEEK_API_KEY),
        explainBusy: busy, scanBusy: scanning, readBusy: reading, used: requests, sessionLimit: maxRequests,
        note: 'Key is kept in memory only; no automatic submission.' }); return;
    }
    if (req.method !== 'POST') { sendJson(res, 404, { error: 'Not Found' }); return; }
    if (!sameOrigin(req)) { sendJson(res, 403, { error: 'Origin or CSRF check failed' }); return; }

    if (url.pathname === '/api/key') {
      const payload = await readJson(req);
      if (payload?.billingAcknowledged !== true) throw Object.assign(new Error('DeepSeek API 按量计费，请先确认已知晓可能扣费。'), { status: 400 });
      const submitted = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : '';
      if (submitted && (submitted.length < 12 || submitted.length > 512)) throw Object.assign(new Error('API Key 格式不正确'), { status: 400 });
      const chosenKey = submitted || process.env.DEEPSEEK_API_KEY || '';
      if (!chosenKey) throw Object.assign(new Error('未找到 DEEPSEEK_API_KEY，请先在此页面粘贴密钥'), { status: 400 });
      apiKey = chosenKey;
      billingAcknowledged = true;
      sendJson(res, 200, { ok: true }); return;
    }
    if (url.pathname === '/api/clear-key') {
      apiKey = '';
      billingAcknowledged = false;
      sendJson(res, 200, { ok: true }); return;
    }
    if (url.pathname === '/api/explain') {
      if (!apiKey || !billingAcknowledged) { sendJson(res, 503, { error: '请在本地页面启用 DeepSeek API 并确认已知晓按量计费' }); return; }
      if (busy) { sendJson(res, 429, { error: '上一条讲解请求尚未结束' }); return; }
      if (requests >= maxRequests) { sendJson(res, 429, { error: '本次运行已达到 20 次请求上限，避免意外超额' }); return; }
      const body = await readJson(req);
      busy = true;
      requests++;
      try {
        const output = await explainQuiz(body, { apiKey });
        sendJson(res, 200, output);
      } finally { busy = false; }
      return;
    }
    if (url.pathname === '/api/questions') {
      if (reading) { sendJson(res, 429, { error: '上一项题目读取仍在进行中' }); return; }
      const body = await readJson(req);
      reading = true;
      try {
        const output = await readQuizQuestions({pointId:body?.pointId,cardNum:body?.cardNum});
        sendJson(res, 200, output);
      } finally { reading = false; }
      return;
    }
    if (url.pathname === '/api/scan') {
      if (scanning) { sendJson(res, 429, { error: '扫描已在进行中' }); return; }
      const body = await readJson(req);
      const maxPoints = Number(body.maxPoints ?? 8);
      const maxCards = Number(body.maxCards ?? 4);
      scanning = true;
      try {
        const output = await scanConfiguredCourse({ maxPoints, maxCards,
          pause: () => new Promise(resolve => setTimeout(resolve, 150)) });
        sendJson(res, 200, output);
      } finally { scanning = false; }
      return;
    }
    sendJson(res, 404, { error: 'Not Found' });
  } catch (error) {
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    const display = status === 500
      ? (String(error.message).startsWith('DeepSeek API HTTP') || /未登录|章节|课程配置|题干|课程笔记|未配置|请求超时|模型|知识点|测验|任务卡|学习通|会话|字体/.test(error.message)
        ? String(error.message).slice(0, 160) : '请求失败，请检查网络及本地诊断信息')
      : String(error.message).slice(0, 160);
    if (!res.headersSent) sendJson(res, status, { error: display });
    else res.end();
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log('AI study helper: ' + origin);
  console.log('DeepSeek API Key: ' + (apiKey ? 'present' : 'not available') + ' (API requests disabled until user confirms billing)');
  console.log('Video playback remains independent at http://127.0.0.1:7788');
});
