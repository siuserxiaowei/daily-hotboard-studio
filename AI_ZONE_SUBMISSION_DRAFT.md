# AI Zone 字段｜AI讯息

## 基础字段

- 工具名称：`AI讯息｜今天真的变了什么`
- 一句话描述：`每天对比上一期，只推送经一手或原始来源核验的 AI 变化回执，最多 3 条。`
- 分类建议：资讯 / 效率（以页面可选项为准）
- 平台：PC、移动端
- 访问方式：`https://siuserxiaowei.github.io/daily-hotboard-studio/`
- GitHub：`https://github.com/siuserxiaowei/daily-hotboard-studio`
- 关联活动：微博 VibeLab
- 相关微博：发布后填入最终参赛微博 URL

## 详细介绍（Markdown）

### 它解决什么问题

AI 信息流的主要痛点不是信息太少，而是重复、不可比和难核验。微博热度、GitHub Stars、论文热度与媒体榜单没有共同量纲，把它们混成一个分数会制造虚假的“今日最重要”。

### Demo 如何工作

AI讯息每天 08:30 拉取公共热榜、官方 RSS、论文和开源源，与上一期快照比较，再执行同事件合并和证据分层。每个候选被标成 `NEW`、`CHANGED`、`CORRECTED` 或 `UNVERIFIED`，整份简报最终进入 `SEND`、`HOLD` 或 `QUIET_DAY`。

- `SEND`：发送 1–3 条有一手/原始证据的变化。
- `HOLD`：存在新信号，但证据不足。
- `QUIET_DAY`：没有值得打扰用户的变化。

网页展示从原始信号到最终回执的漏斗，并给出每条回执的证据链接；原始证据池仍可检索，但不参与跨来源热度排名。项目同时输出 RSS 与可选 HTTPS webhook，未显式开启时 webhook 始终 dry-run。

### 创作思路与工作流

我没有从“怎么把更多热点塞进日报”出发，而是把问题改写成“今天相较昨天，究竟有哪些可证实的变化”。确定性规则负责跨期比较、去重、证据门禁和发送上限，AI 只适合在之后辅助解释语义，不替事实拍板。

### 可验证性

项目测试覆盖误合并防护、四种事件状态、三种发送决策、最多三条、热度隔离、RSS 转义和 webhook 失败关闭。单个来源失败会独立记录，不阻断整次简报。

### 责任边界

这是可追溯的信息筛选工具，不是事实的最终裁决。涉及高风险领域时，应继续打开原始来源复核。

## 资产

- PC 截图：`demo-assets/ai-message-desktop-1440x1000.png`
- 移动截图：`demo-assets/ai-message-mobile-390x844.png`
- 图标：`demo-assets/ai-message-icon-512.png`（512×512 PNG）
