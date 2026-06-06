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
    list: [
      { index: 1, title: "浪姐排名", hot_value: "1279491", url: "https://example.com/a", extra: {} },
      { index: 2, title: "高考期间这些地区雨势较大", hot_value: "69万热度", url: "https://example.com/b", extra: {} }
    ]
  });
  const digest = buildDigest([board], 1);
  assert.equal(board.items[0].platformLabel, "微博热搜");
  assert.equal(digest.length, 1);
  assert.equal(digest[0].title, "浪姐排名");
});

test("voiceover creates reusable script text", () => {
  const script = buildVoiceover([
    {
      title: "热点 A",
      platformLabel: "微博热搜",
      hotValue: "100万热度",
      description: "",
      hotScore: 1000000
    }
  ], "2026-06-06T12:00:00Z");
  assert.match(script.script, /今日热榜速览/);
  assert.match(script.short, /热点 A/);
  assert.equal(script.bullets.length, 1);
});

