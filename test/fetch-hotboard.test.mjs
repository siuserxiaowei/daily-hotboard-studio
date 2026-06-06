import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSnapshot,
  failedBoard,
  fetchBoard,
  HOTBOARD_SOURCE,
  normalizeSuccessBoard,
  parsePlatformList,
  parseRetryAfterMs,
  retryDelayMs,
  updateArchiveIndex,
  upsertArchiveSnapshot
} from "../scripts/fetch-hotboard.mjs";

const fetchedAt = "2026-06-06T16:06:31.415Z";

test("parses platform override lists without duplicates", () => {
  assert.deepEqual(parsePlatformList(" weibo, zhihu,weibo,,bilibili "), ["weibo", "zhihu", "bilibili"]);
  assert.deepEqual(parsePlatformList("", ["weibo", "zhihu"]), ["weibo", "zhihu"]);
  assert.deepEqual(parsePlatformList(",", ["weibo", "zhihu"]), ["weibo", "zhihu"]);
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

  assert.deepEqual(Object.keys(snapshot), ["source", "generatedAt", "platforms", "okCount", "errorCount", "boards"]);
  assert.equal(snapshot.okCount, 1);
  assert.equal(snapshot.errorCount, 1);
  assert.equal(snapshot.boards[0].fetched_at, fetchedAt);
  assert.deepEqual(snapshot.boards[1], {
    type: "zhihu",
    update_time: "",
    list: [],
    error: "HTTP 429 Too Many Requests",
    fetched_at: fetchedAt
  });
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
