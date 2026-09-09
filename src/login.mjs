#!/usr/bin/env node
/* src/login.mjs —— 超星账号登录，导出 cookies.json */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { aesEncrypt, httpPost, info, ok, warn, err, __dirname } from './common.mjs';

const ROOT = path.dirname(__dirname);
const PROFILE = path.join(ROOT, 'browser-profile');
const LOGIN_URL = 'https://passport2.chaoxing.com/login?refer=https%3A%2F%2Fi.chaoxing.com';

function parseArgs(argv) {
  const o = { username: null, password: null, api: false, browser: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => (i + 1 < argv.length ? argv[++i] : null);
    if (a === '--username') o.username = next();
    else if (a === '--password') o.password = next();
    else if (a === '--api') o.api = true;
    else if (a === '--browser') o.browser = true;
    else if (a === '-h' || a === '--help') { console.log('用法: node src/login.mjs [--username 手机号] [--password 密码] [--api|--browser]'); process.exit(0); }
  }
  return o;
}

/* AES API 登录，成功返回 cookie 数组 */
async function apiLogin(username, password) {
  info('尝试 AES 账号密码登录…');
  const data = {
    fid: '-1', uname: aesEncrypt(username), password: aesEncrypt(password),
    refer: 'https%3A%2F%2Fi.chaoxing.com', t: 'true', forbidotherlogin: '0', validate: '', doubleFactorLogin: '0', independentId: '0',
  };
  const r = await httpPost('https://passport2.chaoxing.com/fanyalogin', data);
  let j; try { j = JSON.parse(r.text); } catch { j = { status: false, msg2: r.text.slice(0, 120) }; }
  if (j.status !== true) { warn(`API 登录未成功：${j.msg2 || j.msg || j.status}`); return null; }
  // 从响应头收集 set-cookie
  const setCookies = r.headers && r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  const cookies = setCookies.map((c) => {
    const [pair, ...attrs] = c.split(';');
    const [name, value] = pair.split('=');
    const domain = (attrs.find((a) => a.trim().startsWith('Domain=')) || '').split('=')[1] || '.chaoxing.com';
    return { name: (name || '').trim(), value: (value || '').trim(), domain, path: '/' };
  }).filter((c) => c.name);
  ok(`API 登录成功，拿到 ${cookies.length} 个 Cookie`);
  return cookies.length ? cookies : null;
}

/* 浏览器登录（可靠兜底） */
async function browserLogin() {
  info('打开浏览器登录（扫码或账号密码）…');
  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: false, viewport: null, args: ['--start-maximized'] });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  info('请在打开的浏览器窗口登录（扫码或账号密码），成功后自动继续…');
  const deadline = Date.now() + 10 * 60 * 1000;
  let logged = false;
  while (Date.now() < deadline) {
    const url = page.url(), title = await page.title().catch(() => '');
    const content = await page.content().catch(() => '').then((c) => c.slice(0, 4000));
    const onLogin = /passport2\.chaoxing\.com/.test(url) || /passport2\.chaoxing\.com/.test(content) || (/请登录|账号登录|扫码登录|登录/.test(title) && !/chapter_unit/.test(content));
    if (!onLogin) { logged = true; info(`检测到已登录：${url}`); break; }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!logged) { warn('浏览器登录超时'); await ctx.close(); return null; }
  let cookies = await ctx.cookies();
  cookies = cookies.filter((c) => (c.domain || '').includes('chaoxing.com'));
  await ctx.close();
  return cookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path || '/' }));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let username = opts.username, password = opts.password;
  if (opts.browser || (!opts.api && !opts.username && !opts.password)) {
    // 默认/指定：浏览器登录
    const cookies = await browserLogin();
    if (!cookies) { err('登录未完成'); process.exit(1); }
    const { saveCookies } = await import('./common.mjs');
    saveCookies(cookies);
    ok(`已保存 ${cookies.length} 个 Cookie 到 cookies.json`);
    return;
  }
  if (opts.api || (opts.username && opts.password)) {
    if (!username || !password) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      if (!username) username = (await rl.question('请输入超星账号(手机号/学号): ')).trim();
      if (!password) password = (await rl.question('请输入密码（直接粘贴，回车确认）: ')).trim();
      rl.close();
    }
    const cookies = await apiLogin(username, password);
    if (cookies) {
      const { saveCookies } = await import('./common.mjs');
      saveCookies(cookies);
      ok('已保存 Cookie 到 cookies.json');
      return;
    }
    warn('API 登录失败，尝试浏览器登录…');
    const bcookies = await browserLogin();
    if (!bcookies) { err('登录未完成'); process.exit(1); }
    const { saveCookies } = await import('./common.mjs');
    saveCookies(bcookies);
    ok(`已保存 ${bcookies.length} 个 Cookie 到 cookies.json`);
  }
}

main().catch((e) => { err(`登录出错: ${e.stack || e.message}`); process.exit(1); });
