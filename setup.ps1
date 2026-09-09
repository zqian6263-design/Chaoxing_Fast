# setup.ps1 —— Windows 一键部署
Write-Host "==> Chaoxing_Fast 部署开始"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "!! 未检测到 Node.js，请先安装 Node 18+（https://nodejs.org）"; exit 1
}
Write-Host "Node $(node -v) / npm $(npm -v)"
Write-Host "==> 安装依赖 (playwright)..."
npm install | Out-Null
Write-Host "==> 下载 Chromium 浏览器..."
npx playwright install chromium
Write-Host "==> 部署完成！"
Write-Host "首次运行（需登录，浏览器会弹出登录页面）:"
Write-Host "  node start.mjs --url `"<课程URL>`""
Write-Host "后台挂机+实时进度网页:"
Write-Host "  node start.mjs --headless --url `"<课程URL>`""
