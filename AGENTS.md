# AGENTS.md —— 给 Codex / Claude Code / Hermes / OpenCode 等 Agent 的部署说明

## 目标
在用户机器上部署并持续运行【超星学习通任务点自动完成工具】，让用户只需提供**超星账号密码**和**课程 URL / 从列表选课**，脚本即可稳定跑完该课程的视频任务点。

## 给用户的一句话（直接粘贴给我）
> 在本地部署并运行 https://github.com/zqian6263-design/Chaoxing_Fast 这个项目：安装 Node 18+，运行 setup 完成依赖与 Chromium 浏览器安装，然后用 `node start.mjs` 启动；首次启动时请按提示让我登录超星账号（在弹出页面输入账号密码或扫码），并向我要课程的 URL（或让我用 `--list-courses` 列出后选择）；之后让脚本持续稳定运行，并开启实时进度网页 `http://127.0.0.1:7788`。

## 执行步骤
1. 确认 `node -v >= 18`；若无，安装 Node 18+（或提示用户安装）。
2. 克隆本仓库并进入目录：
   ```bash
   git clone https://github.com/zqian6263-design/Chaoxing_Fast.git
   cd Chaoxing_Fast
   ```
3. 部署依赖与浏览器：
   ```bash
   node setup.mjs
   # 等价：npm install && npx playwright install chromium
   ```
4. 运行（首次会要求登录）：
   ```bash
   node start.mjs
   ```
   - 若未登录，脚本会弹出浏览器登录页 → 提醒用户扫码或输入账号密码 → 登录后 Cookie 保存到 `cookies.json`。
   - 若没有已保存课程，需要让用户提供「课程 URL」。请这样引导用户（用户常在这里卡住）：
     - 让用户用浏览器登录超星网页版，打开要刷的那门课，进入**能看到章节列表**的那一页；
     - 复制**浏览器地址栏的完整网址**，形如 `https://mooc2-ans.chaoxing.com/mooc2-ans/mycourse/stu?courseid=...&clazzid=...&cpi=...`；
     - 强调：一定要含 `courseid` / `clazzid` / `cpi`，别用没有这些参数的首页/门户地址。
   - 或者运行 `node src/chaoxing_watch.mjs --list-courses` 列出账号下的课程，再让用户按编号/课程名选择。
5. 让脚本**持续运行**（真实播放，默认 2 倍速、看到 91% 即完成、断连自动重试），并确保实时进度网页在 `http://127.0.0.1:7788` 可访问（把该地址告诉用户）。
6. 完成后告知用户汇总；若需要续跑，可用 `--start <n>` 跳过已看完的视频。

## 注意
- 只操作**用户自己账号下、用户确认无价值**的课程；不用于考试/作弊。
- 若 API/接口被超星改动导致失败，以 `chaoxing_watch.mjs`（真实播放）为准，它走合法播放路径，成功率高。
- `cookies.json`、`config.json`、`browser-profile/` 均为敏感/本机数据，不要提交。
- 运行环境可能是后台/无界面：用 `node start.mjs --headless`（隐藏浏览器，仍可通过网页看进度）。

## 运行提示（告知用户）
- Dashboard（`http://127.0.0.1:7788`）右上角有 **⏸ 暂停 / ▶ 继续** 按钮；要关电脑先点暂停，之后 `node start.mjs` 会自动续跑（已完成视频不会重复刷）。
- 一个知识点下的**多个视频会全部看完**，不会只看第一个就跳章节。