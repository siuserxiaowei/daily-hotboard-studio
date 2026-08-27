import test from "node:test";
import assert from "node:assert/strict";
import {
  BRIEF_DECISION,
  CHANGE_STATUS,
  buildBriefRss,
  buildChangeBrief,
  flattenSnapshot
} from "../src/change-brief.js";

const NOW = "2026-08-27T00:30:00.000Z";
const YESTERDAY = "2026-08-26T00:30:00.000Z";

function item(title, url, options = {}) {
  return {
    index: options.index ?? 1,
    title,
    url,
    hot_value: options.heat ?? "",
    extra: {
      desc: options.description ?? "",
      source: options.source ?? "",
      sourceLabel: options.sourceLabel ?? "",
      publishedAt: options.publishedAt ?? NOW,
      ...(options.extra || {})
    }
  };
}

function board(type, items, options = {}) {
  return {
    type,
    source_kind: options.sourceKind ?? "ai-source",
    update_time: options.updatedAt ?? NOW,
    list: items
  };
}

function snapshot(boards, generatedAt = NOW) {
  return { generatedAt, itemCount: boards.reduce((sum, value) => sum + value.list.length, 0), boards };
}

test("merges duplicate reports and marks a first-party event NEW", () => {
  const current = snapshot([
    board("openai-news", [item("OpenAI 发布 GPT-6 模型", "https://openai.com/index/gpt-6", { description: "官方发布说明" })]),
    board("hn-ai", [item("GPT-6 正式发布，OpenAI 带来新模型", "https://news.ycombinator.com/item?id=6")])
  ]);

  const brief = buildChangeBrief(current, snapshot([], YESTERDAY));

  assert.equal(brief.decision, BRIEF_DECISION.SEND);
  assert.equal(brief.receipts.length, 1);
  assert.equal(brief.receipts[0].status, CHANGE_STATUS.NEW);
  assert.equal(brief.receipts[0].verified, true);
  assert.equal(brief.receipts[0].evidence.length, 2);
  assert.equal(brief.funnel.signals, 2);
  assert.equal(brief.funnel.events, 1);
  assert.equal(brief.funnel.receipts, 1);
});

test("does not merge unrelated stories that only share generic AI language", () => {
  const current = snapshot([
    board("openai-news", [item("A new personal finance experience in ChatGPT", "https://openai.com/index/personal-finance")]),
    board("deepmind-news", [item("Opening new paths in aging research with AI", "https://deepmind.google/blog/aging-research")])
  ]);

  const brief = buildChangeBrief(current, snapshot([], YESTERDAY));

  assert.equal(brief.receipts.length, 2);
  assert.deepEqual(brief.receipts.map((receipt) => receipt.evidence.length), [1, 1]);
});

test("does not merge unrelated model and news titles just because version numbers overlap", () => {
  const current = snapshot([
    board("hf-models", [
      item(
        "a3ilab/gemma4_12B_6144_lr1e-6_ep5_v6",
        "https://huggingface.co/a3ilab/gemma4_12B_6144_lr1e-6_ep5_v6"
      )
    ]),
    board(
      "hn-ai",
      [item("Kimi K3 与 DeepSeek V4 之间的多模态差异", "https://news.ycombinator.com/item?id=123")],
      { sourceKind: "ai-source" }
    )
  ]);

  const brief = buildChangeBrief(current, snapshot([], YESTERDAY));

  assert.equal(brief.funnel.events, 2);
  assert.equal(brief.receipts.length, 1);
  assert.equal(brief.unverified.length, 1);
});

test("uses stable identity across snapshots instead of loose topical similarity", () => {
  const previous = snapshot(
    [board("hf-blog", [item("Baseten brings inference providers", "https://huggingface.co/blog/older-provider")])],
    YESTERDAY
  );
  const current = snapshot([
    board("hf-blog", [item("Baseten on Hugging Face Inference Providers", "https://huggingface.co/blog/baseten")])
  ]);

  const brief = buildChangeBrief(current, previous);

  assert.equal(brief.receipts[0].status, CHANGE_STATUS.NEW);
});

test("treats a paper page as a primary artifact rather than a vendor announcement", () => {
  const [signal] = flattenSnapshot(
    snapshot([board("hf-daily-papers", [item("A paper", "https://huggingface.co/papers/2606.01886")])])
  );

  assert.equal(signal.evidenceTier, "primary");
  assert.equal(signal.firstParty, true);
});

test("marks a materially updated first-party record CHANGED", () => {
  const url = "https://deepmind.google/discover/blog/gemini-robotics";
  const previous = snapshot(
    [board("deepmind-news", [item("Gemini Robotics 更新", url, { description: "支持 10 种任务", publishedAt: YESTERDAY })])],
    YESTERDAY
  );
  const current = snapshot([
    board("deepmind-news", [item("Gemini Robotics 更新", url, { description: "现已支持 25 种任务和新硬件", publishedAt: NOW })])
  ]);

  const brief = buildChangeBrief(current, previous);

  assert.equal(brief.receipts.length, 1);
  assert.equal(brief.receipts[0].status, CHANGE_STATUS.CHANGED);
  assert.match(brief.receipts[0].whyItMatters, /一手来源/);
});

test("surfaces an explicit correction ahead of ordinary new events", () => {
  const correctedUrl = "https://openai.com/index/service-note";
  const previous = snapshot(
    [board("openai-news", [item("OpenAI 服务将于周五开放", correctedUrl, { description: "周五全面开放", publishedAt: YESTERDAY })])],
    YESTERDAY
  );
  const current = snapshot([
    board("openai-news", [item("更正：OpenAI 服务开放时间调整", correctedUrl, { description: "此前日期不准确，现更正为下周一" })]),
    board("hf-blog", [item("Hugging Face 发布新数据工具", "https://huggingface.co/blog/data-tool")])
  ]);

  const brief = buildChangeBrief(current, previous);

  assert.equal(brief.receipts[0].status, CHANGE_STATUS.CORRECTED);
  assert.equal(brief.receipts[0].evidence[0].firstParty, true);
});

test("holds community-only signals instead of presenting them as facts", () => {
  const current = snapshot([
    board("weibo", [item("网传某公司今晚发布神秘模型", "https://weibo.com/example/rumor", { heat: "9999万" })], {
      sourceKind: "uapi-hotboard"
    })
  ]);

  const brief = buildChangeBrief(current, snapshot([], YESTERDAY));

  assert.equal(brief.decision, BRIEF_DECISION.HOLD);
  assert.equal(brief.receipts.length, 0);
  assert.equal(brief.unverified.length, 1);
  assert.equal(brief.unverified[0].status, CHANGE_STATUS.UNVERIFIED);
  assert.equal(brief.funnel.verified, 0);
});

test("returns QUIET_DAY when first-party evidence has not materially changed", () => {
  const unchanged = board("openai-news", [
    item("OpenAI 安全报告", "https://openai.com/index/safety-report", {
      description: "同一份报告",
      publishedAt: YESTERDAY
    })
  ]);

  const brief = buildChangeBrief(snapshot([unchanged]), snapshot([unchanged], YESTERDAY));

  assert.equal(brief.decision, BRIEF_DECISION.QUIET_DAY);
  assert.deepEqual(brief.receipts, []);
  assert.deepEqual(brief.unverified, []);
});

test("caps receipts at three and ignores incomparable heat values when ordering", () => {
  const makeCurrent = (heats) =>
    snapshot([
      board("openai-news", [item("OpenAI Alpha 发布", "https://openai.com/index/alpha", { heat: heats[0] })]),
      board("deepmind-news", [item("DeepMind Beta 发布", "https://deepmind.google/discover/blog/beta", { heat: heats[1] })]),
      board("hf-blog", [item("Hugging Face Gamma 发布", "https://huggingface.co/blog/gamma", { heat: heats[2] })]),
      board("openai-news", [item("OpenAI Delta 发布", "https://openai.com/index/delta", { heat: heats[3] })])
    ]);

  const first = buildChangeBrief(makeCurrent(["1", "2万", "3亿", "9999万"]), snapshot([], YESTERDAY));
  const second = buildChangeBrief(makeCurrent(["9999万", "3亿", "2万", "1"]), snapshot([], YESTERDAY));

  assert.equal(first.receipts.length, 3);
  assert.deepEqual(
    first.receipts.map((receipt) => receipt.id),
    second.receipts.map((receipt) => receipt.id)
  );
});

test("uses source publication time as a tie-breaker instead of platform popularity", () => {
  const current = snapshot([
    board("openai-news", [
      item("Alpha older event", "https://openai.com/index/older", { publishedAt: "2026-08-25T00:00:00Z", heat: "9亿" }),
      item("Zeta newer event", "https://openai.com/index/newer", { publishedAt: "2026-08-27T00:00:00Z", heat: "1" })
    ])
  ]);

  const brief = buildChangeBrief(current, snapshot([], YESTERDAY));

  assert.equal(brief.receipts[0].title, "Zeta newer event");
});

test("builds an escaped RSS feed containing only verified receipts", () => {
  const brief = buildChangeBrief(
    snapshot([
      board("openai-news", [item("OpenAI <Alpha> & 安全更新", "https://openai.com/index/alpha?x=1&y=2")]),
      board("weibo", [item("未证实消息", "https://weibo.com/rumor")], { sourceKind: "uapi-hotboard" })
    ]),
    snapshot([], YESTERDAY)
  );

  const xml = buildBriefRss(brief, { siteUrl: "https://example.com/ai/", feedUrl: "https://example.com/ai/change-brief.xml" });

  assert.match(xml, /<rss version="2.0">/);
  assert.match(xml, /OpenAI &lt;Alpha&gt; &amp; 安全更新/);
  assert.match(xml, /x=1&amp;y=2/);
  assert.doesNotMatch(xml, /未证实消息/);
});
