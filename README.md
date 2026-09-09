# 🎓 Chaoxing_Fast · 超星学习通任务点自动完成

<p align="center">
  <b>真实播放模式(2倍速 · 看91%即完成) + 接口模式 · 账号密码登录 · 跨平台 · 带实时进度网页</b><br/>
  <i>把「无用网课」交给它，每天省下几小时，解放双手。</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-%E2%89%A518-brightgreen" alt="Node"/>
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue" alt="License"/>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs"/>
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-informational" alt="Platform"/>
  <img src="https://img.shields.io/badge/Powered%20by-Playwright-2ea44f" alt="Playwright"/>
  <img src="https://img.shields.io/github/stars/zqian6263-design/Chaoxing_Fast?style=social" alt="Stars"/>
</p>

> ⚠️ 仅供处理**你自己账号下、确认无学习价值**的课程，请勿用于牟利或代替考试。使用存在被平台风控（验证码拦截、限制学习、封号）的可能，请谨慎、控制频率。

---

## ✨ 特性

- 🖥️ **真实播放模式**：用内置浏览器逐个真实播放视频，播放器自行上报并判定完成 —— 最简单可靠。
- ⚡ **2 倍速播放**：默认加速，节省一半时间（可调）。
- 🎯 **看到 91% 即完成**：适配「观看时长 ≥ 总时长 90%」的完成条件，略留余量防误判（`--ratio` 可调）。
- 🔁 **断连自动重试**：网络偶发 `ERR_CONNECTION_CLOSED` 会自动重试页面加载 / 找播放器，不丢任务。
- 🚀 **并发扫描**：扫描章节用并发请求，507 个知识点从 15 分钟降到约 40 秒。
- 📊 **实时进度网页**：本地打开 `http://127.0.0.1:7788` 即看实时进度、当前视频、本条进度条、日志。
- 🔑 **账号密码登录**：一键登录，Cookie 持久化，无需反复登录；也支持扫码。
- ⏸ **可暂停 / 继续（前端按钮）**：Dashboard 一键暂停，随时关电脑/干别的，重启自动续跑。
- 📚 **一个知识点下多个视频都看完**：不会看完第一个就跳章节。
- 🧩 **接口模式**：适用于允许「秒完成」的课程；对强制真实计时的课程会自动提示改用真实播放。
- 🌐 **跨平台**：Windows / macOS / Linux，Node 18+ 即可。

## 🖼️ 实时进度 Dashboard 截图

![Dashboard](assets/dashboard.png)

> 🎨 **设计系统（Impeccable）**：Dashboard 已用 [Impeccable](https://impeccable.style/) 的设计检测（去 AI 味、提升对比度、优化动画），复检 **0 处问题**。设计规范见 [`DESIGN.md`](DESIGN.md) 与 [`PRODUCT.md`](PRODUCT.md)。

---

## 🤖 给 Agent 的一句话部署提示词

> 把下面这一整行直接发给 **Claude Code / Codex / Hermes / OpenCode** 等 Agent 即可完成本地部署并持续运行：

```
在本地部署并运行 https://github.com/zqian6263-design/Chaoxing_Fast 这个项目：安装 Node 18+，运行 setup 完成依赖与 Chromium 浏览器安装，然后用 node start.mjs 启动；首次启动时请按提示让我登录超星账号（在弹出页面输入账号密码或扫码），并向我要课程的 URL（或让我用 --list-courses 列出后选择）；之后让脚本持续稳定运行，并开启实时进度网页 http://127.0.0.1:7788。
```

> Agent 会自动读取本仓库的 [`AGENTS.md`](AGENTS.md) 获取准确执行步骤。部署完成后，**你只需提供超星账号密码与课程 URL**。
## 🚀 快速开始

### 环境要求

| 依赖 | 说明 |
| --- | --- |
| Node.js ≥ 18 | [下载](https://nodejs.org) |
| Playwright + Chromium | 由 `setup` 自动安装 |

### 一键部署

```bash
# Linux / macOS
./setup.sh
# Windows PowerShell
.\setup.ps1
# 或跨平台
node setup.mjs
```

### 首次运行

```bash
# 登录（会弹出浏览器，扫码或账号密码）+ 指定课程
node start.mjs --url "你的课程主页URL"

# 后台挂机 + 实时进度网页
node start.mjs --headless --url "你的课程主页URL"
# 然后浏览器打开 http://127.0.0.1:7788 查看进度
```

`start.mjs` 会自动完成 3 件事：
1. **登录**：无会话时弹出浏览器 → 登录 → Cookie 保存到 `cookies.json`；
2. **课程**：用 `--url`，或读取上次保存的 `config.json`；
3. **真实播放**：2 倍速 + 看 91% 即完成，遇到断连自动重试。

---

## 📍 课程 URL 是什么？怎么填？

**课程 URL = 你在浏览器里打开那门课程后，地址栏里的那串链接。** 它里面含有脚本需要的三个参数：`courseid`、`clazzid`、`cpi`。

### 怎么拿到？
1. 用浏览器登录 **超星学习通网页版**（`https://mooc2-ans.chaoxing.com` 或你学校入口）。
2. 点进**你想刷的那门课**，进入能看到「章节列表」的那一页。
3. **复制浏览器地址栏的完整网址**即可。

### 长什么样？
```
https://mooc2-ans.chaoxing.com/mooc2-ans/mycourse/stu?courseid=265942178&clazzid=151672181&cpi=568203823&enc=...&t=...
```
其中 `courseid=...`、`clazzid=...`、`cpi=...` 就是脚本需要的。`enc`、`t` 等可有可无。

### 常见坑
- ❌ 别填「课程首页 / 登录后首页」或学校门户地址 —— 没有 `courseid` 的不行。
- ✅ 一定要是**能看到章节列表**的课业页（通常是 `mycourse/stu` 或 `studentcourse`）。
- 懒得分清？用 `node src/chaoxing_watch.mjs --list-courses` 列出账号下所有课程，告诉我课程名或编号即可。

> 用 `node start.mjs` 被问到「请输入课程主页 URL」时，把上面那串地址粘贴进去，或直接 `node start.mjs --url "<那串地址>"`。
## 🧭 常见用法

| 命令 | 说明 |
| --- | --- |
| `node start.mjs --url "<URL>"` | 一键：登录 + 选课程 + 真实播放 |
| `node start.mjs --headless --url "<URL>"` | 后台挂机（不弹浏览器窗口） |
| `node start.mjs --list-courses` | 列出账号下的课程 |
| `node setup.mjs` | 安装依赖 + 下载 Chromium |
| `node src/login.mjs` | 单独登录（浏览器） |
| `node src/chaoxing_watch.mjs --list --url "<URL>"` | 只列出该课程视频，不上报 |

### 常用参数（真实播放）

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| `--url <URL>` | 课程主页 URL（含 courseid/clazzid/cpi） | 必填/记忆 |
| `--rate <n>` | 播放倍速 | `2` |
| `--ratio <n>` | 完成所需时长比例 | `0.91` |
| `--start <n>` | 跳过前 n 个视频（续跑） | `0` |
| `--retry <n>` | 单个视频失败重试次数 | `3` |
| `--scan-concurrency <n>` | 扫描章节点并发 | `6` |
| `--dashboard` / `--port <n>` | 实时进度网页（默认 7788） | 否 |
| `--headless` / `--visible` | 隐藏 / 显示浏览器窗口 | 显示 |

---

## ⏸ 暂停 / 继续 / 关机续跑

- **暂停**：打开 `http://127.0.0.1:7788`，点右上角 **⏸ 暂停**。脚本会**暂停当前视频、不再切下一个**。
  - 也可用接口：`http://127.0.0.1:7788/api/control?action=pause`。
- **继续**：点 **▶ 继续**（或用 `...action=resume`）。
- **关电脑 / 退出**：先点暂停，再关掉电脑或 `Ctrl+C`；进度会由播放器/服务端记录。
- **下次开机快速续跑**：直接 `node start.mjs` 即可（会记住课程），脚本**自动跳过已完成的视频**，从没看完的接着刷。

> 注意：中途关机会导致「当前正在播的那个视频」没刷完，下次会从头补；但**已完成的任务点不会重复**。

## 🧠 工作原理

```
studentcourse 读取章节知识点
        ↓
knowledge/cards(num=0..6) 解析任务卡片    ← 并发扫描提速
        ↓
ananas/status 取 dtoken / duration
        ↓
真实播放器播放 <video>，轮询 currentTime
        ↓
currentTime ≥ ratio×duration  →  播放器上报  →  判定完成
        ↓
下一个视频（自动重试 / 断连重试）
```

- **接口模式**：`ananas/status` → `mooc-ans/multimedia/log/a` 上报进度（`enc` 为超星签名），适用于允许秒完成的课程。

---

## ❓ FAQ

- **提示「需真实播放」**：说明该课程强制真实计时，请用 `start.mjs` 真实播放（默认 2 倍速）。
- **个别视频被跳过**：多为网络偶发断连或转码失败，脚本会重试并提示；可用 `--start` 补跑。
- **登录时出现验证码**：用浏览器登录（`node src/login.mjs`）扫码或账号密码，最稳。
- **浏览器下载失败**：`npx playwright install chromium` 重试。
- **Cookie 失效**：重新运行 `start.mjs`，会再要求登录。

---

## 🤝 Contributing

欢迎 PR！请遵守：
- 保持零描述依赖（核心），仅 `playwright` 为必需运行时依赖。
- 提交前 `node --check` 所有 `.mjs`。
- 不提交 `cookies.json` / `config.json` / `browser-profile/`（已 gitignore）。

---

## 📄 License & Credits

- License: **GPL-3.0**（见 [LICENSE](LICENSE)）
- 接口信息参考自开源项目 [Samueli924/chaoxing](https://github.com/Samueli924/chaoxing)（GPL-3.0，仅作接口研究；本实现为独立实现，未复制其代码）。

## ⭐ 觉得有用就点个 Star！