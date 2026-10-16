# AI 学习辅导：Google Gemini 免费 API

## 已实现

- 本地页面：http://127.0.0.1:7789；与视频进度端口 7788 独立
- 章节测验只读扫描；只展示可确认的任务信息及状态，不提交答案
- 手动粘贴文字题目、选项、课程资料，点击后发送至 Gemini 生成学习解析
- 唯一允许的模型：`gemini-2.5-flash-lite`（Google 官方标注 Free Tier 可用），单次运行最多 20 个请求，无自动重试、无付费模型回退
- Gemini Key 只存储于本地 Node 进程内存中；停止服务后失效；不会写入仓库、日志、配置文件或浏览器存储

## Gemini API Key 获取

Google API Key 是**与你自己的 Google 账户和 Google Cloud 项目绑定**的。不能由项目代码凭空创建，也不能通过第三方通用公共密钥安全替代。

1. 在本机浏览器打开 https://aistudio.google.com/api-keys ，登录你自己的 Google 账户，并阅读、接受服务条款（若有）。
2. 在 AI Studio 的 Projects / Billing 查看项目是否在 **Free tier**，确认**没有开通付费 Billing**。不要使用已启用计费的项目密钥。
3. 选择免费项目已有的 API Key，或点击创建 API Key。不要在聊天中发出密钥。
4. 返回 http://127.0.0.1:7789 ，粘贴密钥，勾选免费项目确认选项，点击“本次会话启用”。
5. 录入一道题干，点击“生成知识点与推理讲解”验证。

**重要：模型具有免费配额，并不代表在付费项目使用该模型一定免费。** API 无法可靠通过密钥反查账单层级，所以项目要求用户手动确认免费项目；已启用计费的项目可能产生费用。免费额度及模型可用性因地区和账户而异，详情查阅 Google 官方定价和配额面板。免费的 API 输入可能被用于改进模型；不要发送个人信息、账号 Cookie 或未获授权的版权材料。

## 技术信息

- REST API：`POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent`
- 密钥通过请求头 `x-goog-api-key` 发送，不放 URL
- 页面使用 HTTP Host / Origin / CSRF 检查；服务仅绑定 `127.0.0.1`
- 仅用户点击时发起调用，无后台调用，无自动答案填充、无自动提交
- 模型回复需要人工核对。扫描到测验任务不意味着得知测验完成状态

## 离线检查

```powershell
cd D:\win\chaoxing
npm test
node src/quiz/server.mjs
```

没有 Gemini Key 仍可使用测验清单扫描。接口测试用模拟返回，不代表已经获得可用的真实密钥。
