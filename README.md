# AI讯息｜今天真的变了什么

AI讯息不是另一份“AI 热榜”。它每天 08:30 对比上一期快照，把同一事件跨来源合并，再经过一手/原始证据门禁，只发送最多 3 条真正发生变化的 AI 回执。

- 在线 Demo：<https://siuserxiaowei.github.io/daily-hotboard-studio/>
- RSS：<https://siuserxiaowei.github.io/daily-hotboard-studio/data/change-brief.xml>
- 当前机器可读回执：[`data/change-brief.json`](data/change-brief.json)
- 桌面/移动演示图：[`demo-assets/`](demo-assets/)

## 为什么做

普通 AI 日报通常把热度、Stars、榜单名次和媒体声量放进同一个分数里，结果既重复又难以核验。AI讯息把问题改成四个更严格的问题：

1. 它和上一期相比真的有变化吗？
2. 多个平台说的是不是同一件事？
3. 能否回到官方公告、原始论文或原始项目页？
4. 这条变化是否值得占用用户注意力？

## 输出协议

每个候选只会进入以下状态之一：

- `NEW`：上一期之后出现，并已有一手或原始证据。
- `CHANGED`：已有事件的关键事实发生实质变化。
- `CORRECTED`：一手来源对旧信息作出更正或撤回。
- `UNVERIFIED`：只有社区、媒体或热榜信号，暂不作为事实推送。

整份简报再经过发送门禁：

- `SEND`：有 1–3 条通过核验的变化回执。
- `HOLD`：有新信号，但一手证据不足。
- `QUIET_DAY`：没有值得打扰用户的实质变化。

排序只使用变化类型、证据等级、来源发布时间和稳定标题。**不会跨来源比较热度、Stars 或榜单名次。**

## 工作流

```text
公共热榜 + 官方 RSS + 论文/开源源
                ↓
        AI 关键词过滤与标准化
                ↓
       与上一期快照做事实差异
                ↓
        同事件合并 + 证据分层
                ↓
 NEW / CHANGED / CORRECTED / UNVERIFIED
                ↓
       SEND / HOLD / QUIET_DAY
                ↓
   网页回执 + RSS + 可选 HTTPS webhook
```

当前来源覆盖公共中文热榜、Hugging Face Daily Papers、arXiv、Hugging Face 模型/数据集/Spaces、GitHub、Hacker News，以及 OpenAI、Google DeepMind、Hugging Face Blog 等官方源。单个来源失败会被隔离记录，不会让整次更新失败。

## 本地运行

```bash
npm install
npm run fetch       # 拉取新快照并生成变化回执
npm test            # 运行单元、集成和推送门禁测试
npm run build       # 构建静态站点并复制数据
npm run dev         # 本地预览
```

已有快照时，可不访问网络重新生成回执：

```bash
npm run brief
```

## 推送方式

RSS 无需凭据，构建后即可订阅 `data/change-brief.xml`。可选 webhook 默认是安全 dry-run：

```bash
npm run publish:brief
```

只有同时显式开启并提供 HTTPS 地址时才会对外发送：

```bash
BRIEF_PUSH_ENABLED=true \
BRIEF_WEBHOOK_URL="https://hooks.example.com/ai-change-brief" \
npm run publish:brief
```

非 `SEND` 决策永远不会调用 webhook；开启推送却缺少 HTTPS 地址时会失败关闭。

## 自动化

`.github/workflows/update-hotboard.yml` 每天 `00:30 UTC`（北京时间 08:30）执行：

1. 拉取数据并保留上一期快照；
2. 生成 `snapshot.json`、`change-brief.json` 和 RSS；
3. 运行测试与生产构建；
4. 在配置了 webhook secrets 时发送 `SEND` 回执；
5. 提交新数据并部署 GitHub Pages。

可选环境变量包括 `UAPI_API_KEY`、`GITHUB_TOKEN`、`X_BEARER_TOKEN`、`JUSTONE_API_TOKEN`、`DOUYIN_ACCESS_TOKEN`。项目不会抓取已登录的私人社交信息。

## 验证

```bash
npm test
node --test --experimental-test-coverage
npm run build
```

关键回归覆盖：同事件合并、稳定跨期身份、误合并防护、四种状态、三种发送决策、最多三条、热度隔离、RSS 转义、webhook dry-run 与失败关闭。

## 数据与责任边界

AI讯息提供的是可追溯的信息筛选，不是事实的最终裁决。论文、项目页和官方公告仍可能被后续修订；页面保留每条回执的证据链接，用户可以直接回到来源核对。涉及金融、医疗、法律、安全或重大突发事件时，不应仅依据自动简报作决策。
