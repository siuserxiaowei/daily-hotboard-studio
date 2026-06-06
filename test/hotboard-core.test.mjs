import test from "node:test";
import assert from "node:assert/strict";
import { buildDigest, buildVoiceover, normalizeBoard, parseHeat } from "../src/hotboard-core.js";

test("parseHeat handles Chinese heat suffixes", () => {
  assert.equal(parseHeat("853 万热度"), 8530000);
  assert.equal(parseHeat("1.2亿"), 120000000);
  assert.equal(parseHeat("3891645播放"), 3891645);
  assert.equal(parseHeat(""), 0);
});

test("normalizes boards and builds a ranked digest", () => {
  const board = normalizeBoard({
    type: "weibo",
    update_time: "2026-06-06 23:51:22",
    ai_filter_summary: {
      matched: 2,
      total: 50,
      keywords: ["OpenAI", "AI芯片"]
    },
    list: [
      { index: 1, title: "OpenAI 发布新模型", hot_value: "1279491", url: "https://example.com/a", extra: { aiMatchedKeywords: ["OpenAI"] } },
      { index: 2, title: "英伟达 AI 芯片供不应求", hot_value: "69万热度", url: "https://example.com/b", extra: { aiMatchedKeywords: ["AI芯片"] } }
    ]
  });
  const digest = buildDigest([board], 1);
  assert.equal(board.items[0].platformLabel, "微博热搜");
  assert.deepEqual(board.aiFilterSummary, {
    matched: 2,
    total: 50,
    keywords: ["OpenAI", "AI芯片"]
  });
  assert.equal(digest.length, 1);
  assert.equal(digest[0].title, "OpenAI 发布新模型");
  assert.deepEqual(digest[0].matchedKeywords, ["OpenAI"]);
});

test("voiceover creates reusable script text", () => {
  const script = buildVoiceover([
    {
      title: "OpenAI 发布新模型",
      platform: "weibo",
      platformLabel: "微博热搜",
      hotValue: "100万热度",
      description: "",
      hotScore: 1000000,
      matchedKeywords: ["OpenAI"]
    }
  ], "2026-06-06T12:00:00Z");
  assert.match(script.script, /今日 AI 热榜速览/);
  assert.match(script.short, /OpenAI 发布新模型/);
  assert.equal(script.bullets.length, 1);
  assert.ok(script.title);
  assert.ok(script.variants.thirtySecond);
});

test("voiceover includes reusable AI publishing assets", () => {
  const script = buildVoiceover([
    {
      title: "OpenAI 发布新模型",
      platform: "douyin",
      platformLabel: "抖音",
      hotValue: "100万热度",
      description: "",
      hotScore: 1000000,
      matchedKeywords: ["OpenAI", "模型"]
    },
    {
      title: "AI 芯片创业公司融资",
      platform: "36kr",
      platformLabel: "36氪",
      hotValue: "80万热度",
      description: "国产 AI 芯片团队获得新融资，云端推理成本成为关注点。",
      hotScore: 800000,
      matchedKeywords: ["AI芯片"]
    }
  ], "2026-06-06T12:00:00Z");

  assert.ok(Array.isArray(script.assets.hooks));
  assert.ok(Array.isArray(script.assets.captions));
  assert.ok(Array.isArray(script.assets.platformAngles));
  assert.match(script.assets.hooks[0], /OpenAI/);
  assert.match(script.assets.hooks[0], /AI/);
  assert.match(script.assets.captions[0], /抖音/);
  assert.match(script.assets.captions[0], /AI/);
  assert.deepEqual(script.assets.platformAngles[0], {
    platform: "抖音",
    title: "OpenAI 发布新模型",
    angle: "围绕 OpenAI、模型 的 AI 话题，适合做技术影响、产品机会或商业化角度拆解。",
    keywords: ["OpenAI", "模型"]
  });
});

test("voiceover uses short-video hook guidance for social video sources", () => {
  const script = buildVoiceover([
    {
      title: "AI 视频模型爆火",
      platform: "douyin",
      platformLabel: "抖音",
      hotValue: "230万热度",
      description: "",
      hotScore: 2300000,
      matchedKeywords: ["AI视频", "视频模型"]
    }
  ], "2026-06-06T12:00:00Z");

  assert.match(script.script, /短视频开场钩子/);
  assert.match(script.variants.thirtySecond.script, /短视频开场钩子/);
});

test("voiceover uses technical product guidance for tech sources", () => {
  const script = buildVoiceover([
    {
      title: "开源模型推理框架更新",
      platform: "ithome",
      platformLabel: "IT之家",
      hotValue: "48万热度",
      description: "",
      hotScore: 480000,
      matchedKeywords: ["开源模型", "模型部署"]
    }
  ], "2026-06-06T12:00:00Z");

  assert.match(script.script, /技术\/产品解读/);
  assert.match(script.variants.thirtySecond.script, /技术\/产品解读/);
});
