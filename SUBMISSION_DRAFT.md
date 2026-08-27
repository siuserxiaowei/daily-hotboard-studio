# 微博 VibeLab 投稿包｜AI讯息

## 参赛信息

- 赛道：`#VibeSocial#`
- 作品名：`AI讯息｜今天真的变了什么`
- 在线 Demo：<https://siuserxiaowei.github.io/daily-hotboard-studio/>
- GitHub：<https://github.com/siuserxiaowei/daily-hotboard-studio>
- RSS：<https://siuserxiaowei.github.io/daily-hotboard-studio/data/change-brief.xml>
- 必需话题：`#微博VibeLab# #VibeSocial#`
- `weibo-cli` 状态：本作品未接入，不使用 `#weibo-cli#`，不申报 CLI 专属激励。

## 可直接发布的微博正文

#微博VibeLab# #VibeSocial#

我做了「AI讯息｜今天真的变了什么」：一份会克制自己的 AI 日报。

普通热榜常把微博热度、GitHub Stars、媒体排名混成一个分数，旧闻换个平台又播一遍。这个 Demo 每天 08:30 做四件事：

① 与上一期快照比差异；
② 把跨平台的同一事件合并；
③ 回到官方公告、原始论文或项目页核验；
④ 最多只发 3 条变化回执。

每条候选会标成 NEW / CHANGED / CORRECTED / UNVERIFIED；整份日报再做 SEND / HOLD / QUIET_DAY 决策。只有传闻就 HOLD，没有实质变化就安静一天，不为了“日更”制造信息。

Demo 里可以看到完整漏斗、每条回执的一手证据和被暂缓的信号；同时提供 RSS 与可选 HTTPS webhook。排序只看变化类型、证据等级和来源时间，不跨来源比较热度、Stars 或榜单名次。

创作思路：我先把“做 AI 日报”改写成“每天证明今天与昨天哪里不同”，再用确定性规则承担合并、核验和发送门禁，让 AI 负责辅助理解，而不是替事实拍板。

在线体验：
https://siuserxiaowei.github.io/daily-hotboard-studio/

源码与完整工作流：
https://github.com/siuserxiaowei/daily-hotboard-studio

## 建议配图顺序

1. `demo-assets/ai-message-desktop-1440x1000.png`：桌面主界面，展示变化漏斗与 3 条官方回执。
2. `demo-assets/ai-message-mobile-390x844.png`：移动端响应式首屏。

## 发布前核对

- [ ] 在线 Demo 已回读为本次提交版本。
- [ ] 两条链接公开可访问。
- [ ] 图片内数据与正文不矛盾。
- [ ] 双话题完整，未添加 `#weibo-cli#`。
- [ ] 发布后保存微博 URL 与时间。
- [ ] 再填写作品返链表并按群公告投递。
