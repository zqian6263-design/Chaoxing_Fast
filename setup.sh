#!/usr/bin/env bash
# setup.sh —— Linux/macOS 一键部署
set -e
echo "==> Chaoxing_Fast 部署开始"
if ! command -v node >/dev/null 2>&1; then
  echo "!! 未检测到 Node.js，请先安装 Node 18+（https://nodejs.org）"; exit 1
fi
echo "Node $(node -v) / npm $(npm -v)"
echo "==> 安装依赖 (playwright)..."
npm install >/dev/null 2>&1 || npm install
echo "==> 下载 Chromium 浏览器..."
npx playwright install chromium || echo "(浏览器下载失败可稍后重试: npx playwright install chromium)"
echo "==> 部署完成！"
echo "首次运行（需登录，浏览器会弹出登录页面）:"
echo "  node start.mjs --url \"<课程URL>\""
echo "后台挂机+实时进度网页:"
echo "  node start.mjs --headless --url \"<课程URL>\""
