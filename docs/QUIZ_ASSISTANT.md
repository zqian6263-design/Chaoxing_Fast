# 本地章节测验学习辅导 · DeepSeek API

## 运行

打开 http://127.0.0.1:7789 ，或从项目根目录执行 `npm run quiz`。

- 视频播放进度服务独立运行于 http://127.0.0.1:7788，不受此模块影响。
- 测验扫描只读，显示任务类型及能够确认的完成状态；不自动作答、填写或提交。
- 用户自行粘贴文字题干、选项及课堂笔记，手动点击生成知识点解析。

## DeepSeek 官方 API

- 接口：`POST https://api.deepseek.com/chat/completions`
- 模型：**`deepseek-flash`**（当前官方推荐 Flash 模型标识）
- 以 `Authorization: Bearer <API Key>` 认证，非流式请求
- 使用非思考模式、单次最多输出 700 tokens、单次运行最多 20 次人工发起调用，无重试，无付费模型自动回退
- Key 先从本机 `DEEPSEEK_API_KEY` 环境变量读取；也可在本地页面粘贴，绝不写入配置文件、GitHub 或日志
- 每次进程启动都需要在页面确认“我知道 DeepSeek API 按 Token 计费”，才能启用调用。
- 模型调用可能收取费用；程序无法验证 DeepSeek 的账户余额或价格。用户可在官方平台核实用量及赠送余额。

文档：https://api-docs.deepseek.com/zh-cn/ ，模型及计费：https://api-docs.deepseek.com/quick_start/pricing/

## 自动读取题干与选项（新功能）

1. 打开 http://127.0.0.1:7789 ，点击“扫描课程测验”。
2. 点击某个 workid 测验对应的“读取题目”，后台启动**独立临时** Playwright Chromium 浏览器，在学习通课程页面加载题目 iframe。
3. Playwright 只允许 GET/HEAD 网络请求；**不会**选中、保存、提交题目；也不会影响正在运行的视频进度服务。
4. 原始 DOM 可识别单选、多选、判断题及 A/B/C/D 等选项。遇到 `font-cxsecret` 字体混淆时，自动在本机生成**题目截图预览**（不上传到 AI），用户根据截图校正文本后才能请求 DeepSeek。
5. 一次可以勾选最多 3 道题，点击“合并选中的题目到讲解框”，随后用户仍需点击“生成知识点与推理讲解”才发生**一次**可能收费的 API 调用。

限制：页面 DOM 结构会随超星版本变化；当前适配已在这门课程的一个 `doHomeWorkNew` 测验页确认成功，并非所有题型/课程全面保证支持。截图里的文字仍需用户人工核对，不会进行 OCR。题目未解码或缺失时严禁当成可靠数据让 AI 推断。测试只检查提取及流程，不读取标准答案。

## 安全与限制

- 浏览器服务仅监听 `127.0.0.1`，关键操作验证 Host / Origin / CSRF。
- Cookie 仅用于本机只读扫描学习通任务，绝不传给 DeepSeek。
- 不自动填入或提交章节测验，正式成绩与平台任务状态以学校系统为准。
- 输入含疑似密钥时拒绝调用，单次超时上限 60 秒。
- AI 回答可能错误，应根据课程教材和老师授课内容进行人工核对。

## 本地测试

```powershell
cd D:\win\chaoxing
npm test
node src/quiz/server.mjs
```
