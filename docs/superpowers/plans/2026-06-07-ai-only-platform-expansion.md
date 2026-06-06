# AI-Only Platform Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen AI-only hotboard extraction, surface AI topics from short-video/social/news/tech platforms, and verify the deployed app end to end.

**Architecture:** Keep the app static and data-driven. The fetch layer owns platform probing, AI keyword matching, and snapshot provenance; `src/hotboard-core.js` owns scoring and voiceover generation; `src/main.js` owns editorial UI rendering and copy actions.

**Tech Stack:** Node.js ESM, native `fetch`, Vite, Node test runner, GitHub Actions, GitHub Pages.

---

## File Map

- Modify: `src/platforms.js`
  - Add richer platform metadata and explicit AI-priority groups.
  - Keep `douyin` in the default fetch list.
  - Do not claim Xiaohongshu support unless the upstream API returns data.
- Modify: `scripts/fetch-hotboard.mjs`
  - Expand AI keyword coverage for Chinese AI product, model, creator, agent, chip, robotics, and short-video terms.
  - Add per-board AI filter summaries that can be shown in the UI.
  - Keep unsupported platform failures isolated to that platform.
- Modify: `src/hotboard-core.js`
  - Add platform-aware voiceover variants for Douyin/social/news/tech.
  - Add extractable publishing assets: title hooks, short-video captions, and bullet outlines.
- Modify: `src/main.js`
  - Render AI-only provenance, platform filter results, matched keywords, and publishing assets.
  - Keep UI compact and editorial, with no generic landing page.
- Modify: `src/styles.css`
  - Add stable layout styles for new content sections, ensuring mobile and desktop text does not overlap.
- Modify: `README.md`
  - Document AI-only behavior, supported platform caveat, refresh commands, and verification workflow.
- Modify: `test/fetch-hotboard.test.mjs`
  - Cover AI keyword matching, board summaries, unsupported platform error isolation, and rate-limit behavior.
- Modify: `test/hotboard-core.test.mjs`
  - Cover platform-aware voiceover, hooks, captions, and publishing asset shape.
- Refresh: `data/snapshot.json`
  - Generate a fresh AI-only snapshot from real UAPI responses.
- Refresh: `data/archive/*.json`
  - Add or update today’s archived snapshot through the fetch script.

## Parallel Work Allocation

### Agent A: AI Platform And Fetching

**Files:**
- Modify: `scripts/fetch-hotboard.mjs`
- Modify: `src/platforms.js`
- Modify: `test/fetch-hotboard.test.mjs`

- [ ] **Step 1: Add failing tests for AI platform summaries**

Add tests that expect `filterBoardsForAi()` to preserve board-level counts and matched keywords:

```js
assert.equal(filtered[0].total_before_filter, 3);
assert.equal(filtered[0].total_after_filter, 2);
assert.deepEqual(filtered[0].ai_filter_summary, {
  matched: 2,
  total: 3,
  keywords: ["OpenAI", "AI芯片"]
});
```

- [ ] **Step 2: Run the targeted test**

Run:

```bash
npm test -- test/fetch-hotboard.test.mjs
```

Expected before implementation: fail on missing `ai_filter_summary`.

- [ ] **Step 3: Implement fetch metadata**

Update `filterBoardsForAi()` so successful boards include:

```js
ai_filter_summary: {
  matched: list.length,
  total: board.list.length,
  keywords: [...new Set(list.flatMap((item) => item.extra.aiMatchedKeywords))].slice(0, 12)
}
```

- [ ] **Step 4: Expand AI keywords conservatively**

Add AI terms that reduce missing AI content without broad false positives:

```js
"AI产品",
"AI工具",
"AI绘画",
"AI音乐",
"AI办公",
"AI教育",
"AI手机",
"AI眼镜",
"AI玩具",
"语音模型",
"视频模型",
"世界模型",
"具身智能",
"人形机器人",
"机器狗",
"RAG",
"向量数据库",
"开源模型",
"模型微调",
"模型部署",
"Token",
"上下文窗口"
```

- [ ] **Step 5: Keep unsupported platform behavior explicit**

Add metadata for `xiaohongshu` only if the API returns a valid board. If upstream returns `invalid hotboard type`, keep it out of `DEFAULT_PLATFORMS` and document that decision.

- [ ] **Step 6: Verify targeted tests**

Run:

```bash
npm test -- test/fetch-hotboard.test.mjs
```

Expected: all fetch tests pass.

### Agent B: AI Publishing Materials

**Files:**
- Modify: `src/hotboard-core.js`
- Modify: `test/hotboard-core.test.mjs`

- [ ] **Step 1: Add failing tests for publishing assets**

Add assertions that `buildVoiceover()` returns:

```js
assert.ok(Array.isArray(script.assets.hooks));
assert.ok(Array.isArray(script.assets.captions));
assert.ok(Array.isArray(script.assets.platformAngles));
assert.match(script.assets.hooks[0], /OpenAI/);
```

- [ ] **Step 2: Run the targeted test**

Run:

```bash
npm test -- test/hotboard-core.test.mjs
```

Expected before implementation: fail on missing `assets`.

- [ ] **Step 3: Implement reusable AI publishing assets**

Add `buildPublishingAssets(top)` that returns:

```js
{
  hooks: top.slice(0, 5).map((item) => `今天 AI 圈这条最值得盯：${item.title}`),
  captions: top.slice(0, 5).map((item) => `${item.title}｜${item.platformLabel}｜${makeAngle(item)}`),
  platformAngles: top.slice(0, 5).map((item) => ({
    platform: item.platformLabel,
    title: item.title,
    angle: makeAngle(item),
    keywords: item.matchedKeywords || []
  }))
}
```

- [ ] **Step 4: Make voiceover platform-aware**

If the first item comes from `douyin`, `bilibili`, or `kuaishou`, the script should say it is more suitable for short-video opening hooks. If it comes from `ithome`, `36kr`, `huxiu`, `hellogithub`, or `v2ex`, the script should favor technical/product interpretation.

- [ ] **Step 5: Verify targeted tests**

Run:

```bash
npm test -- test/hotboard-core.test.mjs
```

Expected: all core tests pass.

### Agent C: Editorial UI And Documentation

**Files:**
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Modify: `README.md`

- [ ] **Step 1: Render AI filter provenance**

Show the snapshot filter mode and keyword count near the top strip:

```js
const filterKeywordCount = state.snapshot.filter?.keywords?.length || 0;
```

Expected UI copy:

```text
AI-only keyword filter · 70+ keywords
```

- [ ] **Step 2: Render publishing material panel**

Add a panel that displays hooks and captions from `voiceover.assets`, with copy buttons for script and digest still working.

- [ ] **Step 3: Add platform caveat copy**

In README, state:

```text
Douyin is included through UAPI when rate limits allow it. Xiaohongshu is not enabled by default because the tested UAPI hotboard types `xiaohongshu` and `xhs` currently return `invalid hotboard type`.
```

- [ ] **Step 4: Style the new panel**

Use stable grid/list dimensions and avoid nested cards. New sections must fit at 320px mobile width and desktop widths.

- [ ] **Step 5: Verify static build**

Run:

```bash
npm run build
```

Expected: Vite build succeeds and `dist/data/snapshot.json` exists.

## Integration Task

**Files:**
- Integrate all modified files from the subagents into the main feature worktree.

- [ ] **Step 1: Review each subagent diff**

Run:

```bash
git diff --stat
git diff -- scripts/fetch-hotboard.mjs src/platforms.js src/hotboard-core.js src/main.js src/styles.css README.md test/fetch-hotboard.test.mjs test/hotboard-core.test.mjs
```

- [ ] **Step 2: Resolve integration conflicts**

Prefer the most conservative behavior:

```text
AI-only content is mandatory.
Unsupported upstream platforms must not be represented as live data.
Rate-limited boards must remain isolated errors, not fail the whole snapshot.
```

- [ ] **Step 3: Run full local verification**

Run:

```bash
npm test
npm run fetch
npm run build
```

Expected:

```text
All tests pass.
Snapshot topic is "ai".
No non-AI entries are knowingly retained.
Build exits 0.
```

- [ ] **Step 4: Run browser/UI verification**

Start local preview or dev server, then inspect the app at desktop and mobile widths. Confirm:

```text
AI-only copy is visible.
Douyin/social platforms are filterable when data exists.
Voiceover and publishing assets render.
Text does not overlap on 320px mobile and desktop.
```

- [ ] **Step 5: Commit**

Run:

```bash
git add scripts/fetch-hotboard.mjs src/platforms.js src/hotboard-core.js src/main.js src/styles.css README.md test/fetch-hotboard.test.mjs test/hotboard-core.test.mjs data/snapshot.json data/archive
git commit -m "feat: strengthen AI-only hotboard extraction"
```

- [ ] **Step 6: Push and deploy**

Run:

```bash
git push origin main
gh workflow run update-hotboard.yml --ref main
gh run watch --exit-status
```

Expected: GitHub Pages deployment succeeds and the live `data/snapshot.json` reports `topic: "ai"`.

## Self-Review

- Spec coverage: AI-only content, Douyin/social extraction, Xiaohongshu caveat, voiceover materials, tests, build, and deployment are covered.
- Placeholder scan: No `TBD`, generic “handle edge cases”, or unspecified test steps remain.
- Type consistency: Snapshot fields use `filter`, `ai_filter_summary`, `extra.aiMatchedKeywords`; UI reads `voiceover.assets`.
