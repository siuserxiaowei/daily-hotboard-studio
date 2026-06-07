import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  AI_KEYWORDS,
  buildSnapshot,
  failedBoard,
  fetchBoard,
  filterBoardsForAi,
  HOTBOARD_SOURCE,
  keywordMatches,
  normalizeSuccessBoard,
  parseKeywordList,
  parsePlatformList,
  parseRetryAfterMs,
  retryDelayMs,
  runFetchHotboard,
  updateArchiveIndex,
  upsertArchiveSnapshot
} from "../scripts/fetch-hotboard.mjs";
import { DEFAULT_PLATFORMS, PLATFORM_META } from "../src/platforms.js";

const fetchedAt = "2026-06-06T16:06:31.415Z";

test("parses platform override lists without duplicates", () => {
  assert.deepEqual(parsePlatformList(" weibo, zhihu,weibo,,bilibili "), ["weibo", "zhihu", "bilibili"]);
  assert.deepEqual(parsePlatformList("", ["weibo", "zhihu"]), ["weibo", "zhihu"]);
  assert.deepEqual(parsePlatformList(",", ["weibo", "zhihu"]), ["weibo", "zhihu"]);
});

test("parses AI keyword override lists without duplicates", () => {
  assert.deepEqual(parseKeywordList(" OpenAI, Claude,OpenAI,,DeepSeek "), ["OpenAI", "Claude", "DeepSeek"]);
});

test("builds snapshot counts and board provenance fields", () => {
  const okBoard = normalizeSuccessBoard(
    {
      type: "weibo",
      update_time: "2026-06-07 00:01:24",
      list: [{ index: 1, title: "热点 A" }]
    },
    "weibo",
    fetchedAt
  );
  const errorBoard = failedBoard("zhihu", "HTTP 429 Too Many Requests", fetchedAt);
  const snapshot = buildSnapshot({
    source: HOTBOARD_SOURCE,
    generatedAt: fetchedAt,
    platforms: ["weibo", "zhihu"],
    boards: [okBoard, errorBoard]
  });

  assert.deepEqual(Object.keys(snapshot), [
    "source",
    "generatedAt",
    "topic",
    "filter",
    "sourceStats",
    "aiSources",
    "platforms",
    "okCount",
    "errorCount",
    "itemCount",
    "boards"
  ]);
  assert.equal(snapshot.topic, "ai");
  assert.equal(snapshot.filter.mode, "ai-keyword-match");
  assert.equal(snapshot.okCount, 1);
  assert.equal(snapshot.errorCount, 1);
  assert.equal(snapshot.itemCount, 1);
  assert.deepEqual(snapshot.sourceStats, {
    totalBoards: 2,
    totalItems: 1,
    byKind: {
      "uapi-hotboard": {
        boards: 2,
        ok: 1,
        errors: 1,
        items: 1
      }
    }
  });
  assert.deepEqual(snapshot.aiSources, []);
  assert.equal(snapshot.boards[0].fetched_at, fetchedAt);
  assert.deepEqual(snapshot.boards[1], {
    type: "zhihu",
    source_kind: "uapi-hotboard",
    update_time: "",
    list: [],
    error: "HTTP 429 Too Many Requests",
    fetched_at: fetchedAt
  });
});

test("runFetchHotboard records only actually fetched AI sources", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "hotboard-fetch-test-"));
  try {
    const snapshot = await runFetchHotboard({
      generatedAt: fetchedAt,
      platforms: ["weibo"],
      includeAiSources: false,
      delayMs: 0,
      dataDir,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            type: "weibo",
            update_time: "now",
            list: [{ index: 1, title: "OpenAI 发布新模型", hot_value: "100万热度" }]
          }),
          { status: 200 }
        ),
      sleep: async () => {}
    });
    const persisted = JSON.parse(await readFile(join(dataDir, "snapshot.json"), "utf8"));

    assert.deepEqual(snapshot.aiSources, []);
    assert.deepEqual(persisted.aiSources, []);
    assert.equal(snapshot.sourceStats.byKind["uapi-hotboard"].items, 1);
    assert.equal(snapshot.sourceStats.byKind["ai-source"], undefined);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("filters boards to AI-matching hotboard items with board summary", () => {
  const boards = [
    normalizeSuccessBoard(
      {
        type: "ithome",
        update_time: "now",
        list: [
          { index: 1, title: "OpenAI 发布新模型", hot_value: "", url: "https://example.com/ai", extra: {} },
          { index: 2, title: "普通社会新闻", hot_value: "", url: "https://example.com/news", extra: {} },
          { index: 3, title: "英伟达 AI 芯片供不应求", hot_value: "", url: "https://example.com/gpu", extra: {} }
        ]
      },
      "ithome",
      fetchedAt
    )
  ];

  const filtered = filterBoardsForAi(boards, ["OpenAI", "AI芯片"]);

  assert.equal(filtered[0].total_before_filter, 3);
  assert.equal(filtered[0].total_after_filter, 2);
  assert.deepEqual(filtered[0].ai_filter_summary, {
    matched: 2,
    total: 3,
    keywords: ["OpenAI", "AI芯片"]
  });
  assert.deepEqual(filtered[0].list.map((item) => item.title), ["OpenAI 发布新模型", "英伟达 AI 芯片供不应求"]);
  assert.deepEqual(filtered[0].list[0].extra.aiMatchedKeywords, ["OpenAI"]);
});

test("records empty AI filter summaries for successful boards with no matches", () => {
  const boards = [
    normalizeSuccessBoard(
      {
        type: "weibo",
        update_time: "now",
        list: [{ index: 1, title: "普通社会新闻", hot_value: "", url: "https://example.com/news", extra: {} }]
      },
      "weibo",
      fetchedAt
    )
  ];

  const filtered = filterBoardsForAi(boards, ["OpenAI"]);

  assert.deepEqual(filtered[0].list, []);
  assert.deepEqual(filtered[0].ai_filter_summary, {
    matched: 0,
    total: 1,
    keywords: []
  });
});

test("matches short Latin AI keywords with boundaries", () => {
  assert.equal(keywordMatches("AI", "AI应用爆发"), true);
  assert.equal(keywordMatches("AI", "OpenAI 发布"), false);
  assert.equal(keywordMatches("OpenAI", "OpenAI 发布"), true);
});

test("ships conservative AI keyword coverage for product, model, agent, chip, robotics, and RAG terms", () => {
  for (const keyword of [
    "AI产品",
    "AI工具",
    "语音模型",
    "视频模型",
    "世界模型",
    "具身智能",
    "人形机器人",
    "RAG",
    "向量数据库",
    "模型微调",
    "模型部署",
    "Token",
    "上下文窗口"
  ]) {
    assert.equal(AI_KEYWORDS.includes(keyword), true, `${keyword} should be in AI_KEYWORDS`);
  }

  assert.equal(keywordMatches("RAG", "RAG 检索增强生成方案更新"), true);
  assert.equal(keywordMatches("Token", "上下文 Token 成本下降"), true);
  assert.equal(keywordMatches("Token", "tokenization library"), false);
});

test("keeps Douyin enabled and Xiaohongshu disabled until UAPI returns a valid board", () => {
  assert.equal(DEFAULT_PLATFORMS.includes("douyin"), true);
  assert.equal(Boolean(PLATFORM_META.douyin), true);
  assert.equal(DEFAULT_PLATFORMS.includes("xiaohongshu"), false);
  assert.equal(DEFAULT_PLATFORMS.includes("xhs"), false);
});

test("deduplicates archive snapshots by generated minute", () => {
  const previous = buildSnapshot({
    generatedAt: "2026-06-06T16:06:10.000Z",
    platforms: ["weibo"],
    boards: [failedBoard("weibo", "old", "2026-06-06T16:06:10.000Z")]
  });
  const olderMinute = buildSnapshot({
    generatedAt: "2026-06-06T16:05:59.000Z",
    platforms: ["zhihu"],
    boards: [failedBoard("zhihu", "kept", "2026-06-06T16:05:59.000Z")]
  });
  const replacement = buildSnapshot({
    generatedAt: "2026-06-06T16:06:55.000Z",
    platforms: ["weibo"],
    boards: [normalizeSuccessBoard({ type: "weibo", update_time: "now", list: [] }, "weibo", "2026-06-06T16:06:55.000Z")]
  });

  const archive = upsertArchiveSnapshot({ date: "2026-06-06", snapshots: [previous, olderMinute] }, replacement);

  assert.equal(archive.date, "2026-06-06");
  assert.equal(archive.snapshots.length, 2);
  assert.equal(archive.snapshots[0].generatedAt, "2026-06-06T16:05:59.000Z");
  assert.equal(archive.snapshots[1].generatedAt, "2026-06-06T16:06:55.000Z");
  assert.equal(archive.snapshots[1].okCount, 1);
});

test("keeps archive index to the newest 60 dates", () => {
  const existingDates = Array.from({ length: 65 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, index + 1));
    return date.toISOString().slice(0, 10);
  });

  const index = updateArchiveIndex({ dates: existingDates }, "2026-03-20");

  assert.equal(index.dates.length, 60);
  assert.equal(index.dates[0], "2026-03-20");
  assert.deepEqual(index.dates, [...index.dates].sort().reverse());
  assert.equal(index.dates.includes("2026-01-01"), false);
});

test("parses Retry-After seconds and HTTP dates", () => {
  assert.equal(parseRetryAfterMs("2"), 2000);
  assert.equal(
    parseRetryAfterMs("Wed, 21 Oct 2015 07:28:00 GMT", Date.parse("Wed, 21 Oct 2015 07:27:59 GMT")),
    1000
  );
  assert.equal(retryDelayMs({ status: 429, retryAfter: "3", attempt: 2, delayMs: 100 }), 3000);
  assert.equal(retryDelayMs({ status: 500, retryAfter: "3", attempt: 2, delayMs: 100 }), 400);
});

test("fetchBoard retries 429 with Retry-After and keeps fetched_at on success", async () => {
  const waits = [];
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response("{}", {
        status: 429,
        statusText: "Too Many Requests",
        headers: { "retry-after": "1" }
      });
    }
    return new Response(
      JSON.stringify({
        type: "weibo",
        update_time: "2026-06-07 00:01:24",
        list: [{ index: 1, title: "热点 A" }]
      }),
      { status: 200 }
    );
  };

  const board = await fetchBoard("weibo", {
    generatedAt: fetchedAt,
    delayMs: 100,
    timeoutMs: 1000,
    fetchImpl,
    sleep: async (ms) => waits.push(ms)
  });

  assert.equal(calls, 2);
  assert.deepEqual(waits, [1000]);
  assert.equal(board.error, undefined);
  assert.equal(board.fetched_at, fetchedAt);
});

test("fetchBoard records one platform error instead of throwing", async () => {
  let calls = 0;
  const waits = [];
  const board = await fetchBoard("zhihu", {
    generatedAt: fetchedAt,
    delayMs: 50,
    timeoutMs: 1000,
    maxRetries: 2,
    fetchImpl: async () => {
      calls += 1;
      throw new Error("network down");
    },
    sleep: async (ms) => waits.push(ms)
  });

  assert.equal(calls, 3);
  assert.deepEqual(waits, [100, 200]);
  assert.deepEqual(board, {
    type: "zhihu",
    source_kind: "uapi-hotboard",
    update_time: "",
    list: [],
    error: "network down",
    fetched_at: fetchedAt
  });
});

test("fetchBoard sends optional UAPI API key header", async () => {
  let observedHeaders;
  await fetchBoard("weibo", {
    generatedAt: fetchedAt,
    delayMs: 0,
    timeoutMs: 1000,
    apiKey: "test-key",
    fetchImpl: async (_url, init) => {
      observedHeaders = init.headers;
      return new Response(JSON.stringify({ type: "weibo", update_time: "now", list: [] }), { status: 200 });
    },
    sleep: async () => {}
  });

  assert.equal(observedHeaders.accept, "application/json");
  assert.equal(observedHeaders["X-API-Key"], "test-key");
});
