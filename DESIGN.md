# DESIGN.md — Chaoxing_Fast Dashboard 设计系统

> 由 Impeccable 重构自「内容结构 → 设计规范」，供 Agent 在后续改动中保持一致。

## 目的
一个**实时进度看板**：展示刷课进度、当前视频、本条进度、最近日志，并提供一键暂停/继续。目标是**信息即所见、克制、无冗余**。

## 颜色 (Color)
| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#f6f7f9` | 页面背景 |
| `--surface` | `#ffffff` | 卡片 |
| `--border` | `#e5e7eb` | 卡片描边 |
| `--text` | `#1a202c` | 正文 |
| `--text-muted` | `#6b7280` | 标签/次要 |
| `--accent` | `#2563eb` | 主强调（进度条） |
| `--accent-strong` | `#1d4ed8` | 按钮（可达 WCAG AA） |
| `--ok` | `#dcfce7` / 文字 `#14532d` | 完成徽标 |
| `--info` | `#e0f2fe` / 文字 `#075985` | 播放中徽标 |
| `--warn` | `#eef2ff` / 文字 `#3730a3` | 扫描/提示徽标 |

## 字体 (Type)
- 字体族：`system-ui, Segoe UI, Microsoft YaHei, sans-serif`
- 标题：`22 / 600`；主数字：`42 / 700`；卡片标题：`18 / 600`；正文/标签：`13–14 / 400`；日志：`13 monospace`。

## 形状 (Shape)
- 卡片圆角 `14px`；输入/徽标 `999px`（pill）；进度条圆角 `999px`；按钮圆角 `8px`。

## 间距与布局 (Spacing & Layout)
- 页面留白 `24px`；卡片间距 `16px`；卡片内边距 `20px`。
- 单列卡片流；顶部：标题 + 副标题 + 主卡片（阶段徽标 · 总数 · 进度条 + 右上角暂停按钮）。
- 不用网格/双栏，保持一眼可读。

## 动效 (Motion)
- 仅用 `transform` 做进度条动画（`scaleX`，`transform-origin:left`，`transition: transform .5s`），**避免 width/height/padding 动画**导致的布局抖动。
- 按钮 hover 仅变背景色；无脉冲、无弹跳、无自动播放动画。

## 组件 (Components)
- **Badge**：状态徽标（scan / watch / done）。
- **ProgressBar**：`scaleX` 填充，浅灰轨道 + 强调色填充。
- **Button（暂停）**：主蓝色，白字（AA 对比），可点击切换 暂停/继续。
- **LogList**：等宽字体，最近 80 行，自动滚动到底。

## 反模式 (Avoid)
- ❌ 暗底 + 青色/紫色渐变（AI 味）
- ❌ 过低的文本对比度（< 4.5:1）
- ❌ `transition: width/height` 动画
- ❌ 标题与按钮争抢视觉焦点
