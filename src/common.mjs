/* src/common.mjs —— 共享工具 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.dirname(__dirname);
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36';

const COOKIE_JSON = path.join(ROOT, 'cookies.json');
const COOKIE_TXT = path.join(ROOT, 'cookies.txt');
const CONFIG = path.join(ROOT, 'config.json');

export function log(level, msg) {
  const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const tag = level === 'ok' ? '[完成]' : level === 'warn' ? '[警告]' : level === 'err' ? '[错误]' : '[信息]';
  console.log(`${t} ${tag} ${msg}`);
}
export const info = (m) => log('info', m);
export const ok = (m) => log('ok', m);
export const warn = (m) => log('warn', m);
export const err = (m) => log('err', m);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rand = (a, b) => a + Math.random() * (b - a);

/* ---------- Cookie ---------- */
// 统一返回 [{name,value,domain,path}], 未登录返回 []
export function readCookieFile() {
  if (fs.existsSync(COOKIE_JSON)) {
    try { const a = JSON.parse(fs.readFileSync(COOKIE_JSON, 'utf8')); if (Array.isArray(a) && a.length) return a; } catch {}
  }
  if (fs.existsSync(COOKIE_TXT)) {
    let raw = fs.readFileSync(COOKIE_TXT, 'utf8').trim();
    if (raw.startsWith('Cookie:')) raw = raw.replace(/^Cookie:\s*/i, '');
    if (raw.startsWith('[')) { try { const a = JSON.parse(raw); if (Array.isArray(a)) return a.map(c => ({ name: c.name, value: c.value, domain: c.domain || '.chaoxing.com', path: c.path || '/' })); } catch {} }
    return raw.split(';').map(s => s.trim()).filter(Boolean).map(kv => { const i = kv.indexOf('='); return { name: kv.slice(0, i).trim(), value: kv.slice(i + 1), domain: '.chaoxing.com', path: '/' }; });
  }
  return [];
}
export function saveCookies(cookies) {
  fs.writeFileSync(COOKIE_JSON, JSON.stringify(cookies, null, 2), 'utf8');
  try { fs.writeFileSync(COOKIE_TXT, cookies.map(c => `${c.name}=${c.value}`).join('; '), 'utf8'); } catch {}
}
export function cookieHeader(cookies) { return (cookies || []).map(c => `${c.name}=${c.value}`).join('; '); }
export function cookieValue(cookies, name) { const c = (cookies || []).find(x => x.name === name); return c ? c.value : (name === 'fid' ? '1024' : null); }
export function hasSession(cookies) { return (cookies || []).some(c => c.name === '_uid' || c.name === 'UID'); }

/* ---------- 配置 ---------- */
export function readConfig() { try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return {}; } }
export function writeConfig(cfg) { fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), 'utf8'); }

/* ---------- HTTP（带 Cookie） ---------- */
export async function httpGet(url, params = {}, cookie = '', referer = '') {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const h = { 'User-Agent': UA };
  if (cookie) h.Cookie = cookie;
  if (referer) h.Referer = referer;
  const r = await fetch(u, { headers: h });
  return { status: r.status, text: await r.text(), url: u.toString() };
}
export async function httpPost(url, data = {}, cookie = '', extraHeaders = {}) {
  const h = { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', ...extraHeaders };
  if (cookie) h.Cookie = cookie;
  const r = await fetch(url, { method: 'POST', headers: h, body: new URLSearchParams(data) });
  return { status: r.status, text: await r.text(), url };
}

/* ---------- AES 加密（超星登录用） ---------- */
export function aesEncrypt(plaintext) {
  const key = Buffer.from('u2oh6Vu^HWe4_AES', 'utf8'); // 16 字节
  const iv = key;
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  let enc = cipher.update(plaintext, 'utf8', 'base64');
  enc += cipher.final('base64');
  return enc;
}

/* ---------- 课程 URL -> 参数 ---------- */
export function courseFromUrl(url) {
  const f = {};
  for (const k of ['courseid', 'clazzid', 'cpi', 'enc']) {
    const m = new RegExp(`[?&]${k}=([^&]+)`).exec(url || '');
    if (m) f[k] = decodeURIComponent(m[1]);
  }
  if (!f.courseid || !f.clazzid || !f.cpi) return null;
  return { courseId: f.courseid, clazzId: f.clazzid, cpi: f.cpi, enc: f.enc || '' };
}

/* ---------- 课程列表（best-effort，正则解析） ---------- */
export async function listCourses(cookie) {
  const base = 'https://mooc2-ans.chaoxing.com/mooc2-ans/visit/courselistdata';
  const r = await httpPost(base, { courseType: 1, courseFolderId: 0, query: '', superstarClass: 0 }, cookie, { Referer: 'https://mooc2-ans.chaoxing.com/mooc2-ans/visit/interaction' });
  const text = r.text;
  const courses = [];
  // 常见结构：<a ... href="...courseId=...&clazzid=...&cpi=...">课程名</a> 或 data 属性
  for (const m of text.matchAll(/courseid=(?:'|\")?(\d+)[^>]*?clazzid=(?:'|\")?(\d+)/g)) {
    const courseId = m[1], clazzId = m[2];
    const cpi = (m[0].match(/cpi=(?:'|\")?(\d+)/) || [])[1] || '';
    courses.push({ courseId, clazzId, cpi });
  }
  // 去重
  const seen = new Set(), out = [];
  for (const c of courses) { const k = `${c.courseId}`; if (!seen.has(k)) { seen.add(k); out.push(c); } }
  return out;
}

export const COURSE_TITLES_BY_ID = {};
