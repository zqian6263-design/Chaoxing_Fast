# Chaoxing_Fast

超星学习通（泛雅 / 尔雅）**任务点自动完成**工具，跨平台（Windows / Linux / macOS），支持：
- **真实播放模式**（推荐）：用内置浏览器逐个真实播放视频，播放器自行上报进度并判定完成。支持 **2 倍速**、**看到 91% 即完成**、**并发扫描**、**本地实时进度网页**、**断连自动重试**。
- **接口模式**：适用于允许“秒完成”的课程；对需要真实计时的课程会明确提示改用真实播放。
- **账号密码登录**：浏览器一键登录，稍后 Cookie 持久化，无脚本不用反复登录。

> ⚠️ 仅供处理**你自己账号下、确认无学习价值**的课程，请勿用于牟利或代替考试。使用本工具存在被平台风控（验证码拦截、限制学习、封号）的可能，请谨慎、控制频率。

## 环境要求

- **Node.js 18+**（没有则先安装：https://nodejs.org）
- 真实播放模式需要 `playwright` 及其 Chromium 浏览器（由 setup 自动下载）。

## 快速开始（命令行）

```bash
# 1. 部署（安装 playwright + 下载 Chromium）
node setup.mjs          # 或 ./setup.sh (Linux/macOS) / setup.ps1 (Windows)

# 2. 首次运行：登录 + 指定课程
node start.mjs --url "你的课程主页URL"

# 后台挂机 + 实时进度网页
node start.mjs --headless --url "你的课程主页URL"
#   然后浏览器打开 http://127.0.0.1:7788 看实时进度
```

`start.mjs` 会：
1. 检测是否已登录；未登录时**弹出浏览器**让你扫码/输账号密码登录（Cookie 保存到 `cookies.json`）；
2. 读取/保存课程（`--url` 或上次保存的 `config.json`）；
3. 启动**真实播放**，可用 `--dashboard` 开实时网页，`--rate 2` 倍速，`--ratio 0.91` 看到 91% 即完成。

## 给 Agent（Claude Code / Codex / Hermes / OpenCode 等）的一句话部署

把下面这行直接发给你的 Agent 即可：

> 在本地部署并运行 https://github.com/zqian6263-design/Chaoxing_Fast 这个项目：安装 Node 18+，运行 setup 完成依赖与 Chromium 浏览器安装，然后用 `node start.mjs` 启动；首次启动时请按提示让我登录超星账号（在弹出页面输入账号密码或扫码），并向我要课程的 URL（或让我用 `--list-courses` 列出后选择）；之后让脚本持续稳定运行，并开启实时进度网页 `http://127.0.0.1:7788`。

Agent 会读取本仓库的 `AGENTS.md` 获得准确步骤。

## 常用命令 / 参数

| 命令 | 说明 |
| --- | --- |
| `node start.mjs --url "<课程URL>"` | 一键：登录(如需)+选课程+真实播放 |
| `node start.mjs --headless -url "<课程URL>"` | 后台挂机（不弹浏览器窗口） |
| `node setup.mjs` | 安装依赖 + 下载 Chromium |
| `node src/login.mjs` | 单独登录（浏览器） |
| `node src/chaoxing_watch.mjs --list --url "<URL>"` | 只列出该课程的视频任务 |
| `node src/chaoxing_watch.mjs --list-courses` | 列出账号下的课程 |

真实播放参数：
- `--url <URL>`：课程主页 URL（内含 courseid/clazzid/cpi）
- `--rate <n>`：播放倍速，默认 `2`
- `--ratio <n>`：完成所需时长比例，默认 `0.91`
- `--start <n>`：跳过前 n 个视频（续跑）
- `--retry <n>`：单个视频失败重试次数，默认 `3`
- `--scan-concurrency <n>`：扫描章节点并发，默认 `6`
- `--dashboard` / `--port <n>`：实时进度网页（默认 `7788`）
- `--headless` / `--visible`：隐藏 / 显示浏览器窗口

## 数据文件

- `cookies.json`：登录会话（已 gitignore）
- `config.json`：保存的课程（已 gitignore）
- `browser-profile/`：Playwright 登录后的浏览器数据（已 gitignore）

## 常见问题

- **未检测到 Node.js**：先装 Node 18+。
- **浏览器下载失败**：`npx playwright install chromium` 重试。
- **提示需真实播放**：本课程要求真实计时，请用真实播放模式（`start.mjs`）。
- **个别视频被跳过**：多为网络偶发断连或转码失败，脚本会自动重试并提示，可用 `--start` 补跑。
- **登录失败 / 验证码**：用浏览器登录（`node src/login.mjs`）走扫码或账号密码，更稳。
- **Cookie 失效**：重新运行 `node src/login.mjs` 或 `node start.mjs` 会重新要求登录。

## 原理（写给维护者）

1. `GET mooc2-ans.../mycourse/studentcourse` → 解析章节知识点。
2. `GET mooc1.../mooc-ans/knowledge/cards?num=0~6` → 每个知识点返回 HTML，内嵌 `mArg={...}`，解析任务卡片。
3. 真实播放：在播放器 iframe 里播放 `video` 元素，轮询 `currentTime` 直到 `≥ ratio×duration`，等播放器上报后切下一视频。
4. 接口模式：`GET ananas/status` 取 `dtoken/duration`，`GET mooc-ans/multimedia/log/a` 上报进度（`enc` 为超星签名）。

接口信息参考自开源项目 [Samueli924/chaoxing](https://github.com/Samueli924/chaoxing)（GPL-3.0，仅作接口研究；本实现为独立实现，未复制其代码）。

## License

[GPL-3.0](LICENSE)
