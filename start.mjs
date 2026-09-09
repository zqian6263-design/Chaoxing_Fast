#!/usr/bin/env node
/* start.mjs —— 一键入口：登录(如需) -> 确定课程 -> 运行真实播放
   用法：node start.mjs [--url "<课程URL>"] [--dashboard] [--headless|--visible] [--rate 2] */
import { execFileSync } from 'node:child_process';
import readline from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCookieFile, hasSession, courseFromUrl, readConfig, writeConfig, info, ok, warn, err, ROOT } from './src/common.mjs';

function parseArgs(argv) {
  const o = { url: null, headless: false, dashboard: true, rate: 2, ratio: 0.91, listCourses: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => (i + 1 < argv.length ? argv[++i] : null);
    switch (a) {
      case '--url': o.url = next(); break;
      case '--headless': o.headless = true; break;
      case '--visible': o.headless = false; break;
      case '--dashboard': o.dashboard = true; break;
      case '--no-dashboard': o.dashboard = false; break;
      case '--rate': o.rate = parseFloat(next()); break;
      case '--ratio': o.ratio = Math.min(1, Math.max(0.1, parseFloat(next()))); break;
      case '--list-courses': o.listCourses = true; break;
      case '-h': case '--help': console.log('用法: node start.mjs [--url "<课程URL>"] [--headless] [--dashboard] [--rate 2]'); process.exit(0); break;
      default: err(`未知参数: ${a}`); process.exit(1);
    }
  }
  return o;
}

function runNode(rel, args) {
  execFileSync(process.execPath, [path.join(ROOT, rel), ...args], { stdio: 'inherit' });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // 1) 登录（未登录/无会话时）
  if (!hasSession(readCookieFile())) {
    warn('未检测到登录，将打开浏览器让你登录超星账号（扫码或账号密码）…');
    runNode('src/login.mjs', ['--browser']);
    if (!hasSession(readCookieFile())) { err('登录未完成，退出'); process.exit(1); }
    ok('登录成功，已保存会话');
  } else {
    ok('已登录');
  }

  // 2) 确定课程
  let url = opts.url;
  const cfg = readConfig();
  if (!url && cfg.course && cfg.course.url) { url = cfg.course.url; info(`使用上次课程: ${url}`); }
  if (!url) {
    if (opts.listCourses) { runNode('src/chaoxing_watch.mjs', ['--list-courses']); return; }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    url = (await rl.question('请输入课程主页 URL: ')).trim();
    rl.close();
  }
  const course = courseFromUrl(url);
  if (!course) { err('URL 解析不到 courseid/clazzid/cpi，请检查'); process.exit(1); }
  writeConfig({ ...cfg, course: { ...course, url } });

  // 3) 运行真实播放
  const watchArgs = ['--url', url, `--rate`, String(opts.rate), `--ratio`, String(opts.ratio)];
  if (opts.headless) watchArgs.push('--headless'); else watchArgs.push('--visible');
  if (opts.dashboard) watchArgs.push('--dashboard');
  info('开始真实播放，可在浏览器打开 http://127.0.0.1:7788 查看进度…');
  runNode('src/chaoxing_watch.mjs', watchArgs);
}

main().catch((e) => { err(`启动出错: ${e.stack || e.message}`); process.exit(1); });
