#!/usr/bin/env node
/* setup.mjs —— 跨平台安装依赖 + 下载 Chromium */
import { execSync } from 'node:child_process';
console.log('==> Chaoxing_Fast 部署');
try { execSync('npm install', { stdio: 'inherit' }); } catch (e) { console.error('npm install 失败', e.message); }
try { execSync('npx playwright install chromium', { stdio: 'inherit' }); } catch (e) { console.error('playwright 浏览器下载失败，可稍后重试: npx playwright install chromium'); }
console.log('==> 部署完成！运行: node start.mjs --url "<课程URL>"');
