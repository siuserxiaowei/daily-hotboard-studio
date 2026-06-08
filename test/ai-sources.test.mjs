import test from "node:test";
import assert from "node:assert/strict";
import {
  createAiSourceDefinitions,
  dedupeBoardsByIdentity,
  fetchAiSourceBoard,
  fetchAiSourceBoards,
  normalizeSourceItems,
  parseAiSourceList
} from "../scripts/ai-sources.mjs";

const generatedAt = "2026-06-06T18:00:00.000Z";

test("parses AI source override lists and off switches", () => {
  assert.deepEqual(parseAiSourceList(" hf-models, github-ai,hf-models "), ["hf-models", "github-ai"]);
  assert.deepEqual(parseAiSourceList("false"), []);
  assert.deepEqual(parseAiSourceList("", ["hf-models"]), ["hf-models"]);
});

test("normalizes Hugging Face daily papers into hotboard items", () => {
  const source = createAiSourceDefinitions(new Date(generatedAt)).find((item) => item.id === "hf-daily-papers");
  const list = normalizeSourceItems(
    source,
    JSON.stringify([
      {
        paper: {
          id: "2606.05515",
          title: "BRepCLIP: Contrastive Multimodal Pretraining",
          ai_summary: "A CAD representation learning paper.",
          ai_keywords: ["CLIP", "CAD"],
          upvotes: 7
        },
        numComments: 3,
        thumbnail: "https://example.com/thumb.png",
        publishedAt: generatedAt
      }
    ])
  );

  assert.equal(list.length, 1);
  assert.equal(list[0].title, "BRepCLIP: Contrastive Multimodal Pretraining");
  assert.equal(list[0].url, "https://huggingface.co/papers/2606.05515");
  assert.equal(list[0].hot_value, "3 讨论 / 7 upvotes");
  assert.deepEqual(list[0].extra.aiMatchedKeywords.slice(0, 5), ["AI", "论文", "Hugging Face", "CLIP", "CAD"]);
});

test("normalizes arXiv Atom entries", () => {
  const source = createAiSourceDefinitions(new Date(generatedAt)).find((item) => item.id === "arxiv-ai");
  const list = normalizeSourceItems(
    source,
    `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>https://arxiv.org/abs/2606.00001</id>
        <title>Agentic Retrieval for AI Systems</title>
        <summary>We study agentic retrieval.</summary>
        <published>2026-06-06T00:00:00Z</published>
        <category term="cs.AI" />
        <category term="cs.CL" />
      </entry>
    </feed>`
  );

  assert.equal(list.length, 1);
  assert.equal(list[0].url, "https://arxiv.org/abs/2606.00001");
  assert.equal(list[0].hot_value, "cs.AI / cs.CL");
  assert.deepEqual(list[0].extra.aiMatchedKeywords, ["AI", "arXiv", "论文", "cs.AI", "cs.CL"]);
});

test("normalizes RSS items", () => {
  const source = createAiSourceDefinitions(new Date(generatedAt)).find((item) => item.id === "openai-news");
  const list = normalizeSourceItems(
    source,
    `<?xml version="1.0" encoding="UTF-8"?>
    <rss><channel><title>OpenAI News</title><item>
      <title>New AI agent release</title>
      <link>https://openai.com/news/example</link>
      <description><![CDATA[<p>Official update.</p>]]></description>
      <pubDate>Sat, 06 Jun 2026 10:00:00 GMT</pubDate>
    </item></channel></rss>`
  );

  assert.equal(list.length, 1);
  assert.equal(list[0].title, "New AI agent release");
  assert.equal(list[0].extra.desc, "Official update.");
  assert.deepEqual(list[0].extra.aiMatchedKeywords, ["AI", "OpenAI", "官方发布"]);
});

test("fetchAiSourceBoard records source errors instead of throwing", async () => {
  const source = createAiSourceDefinitions(new Date(generatedAt)).find((item) => item.id === "hn-ai");
  const board = await fetchAiSourceBoard(source, {
    generatedAt,
    fetchImpl: async () => {
      throw new Error("network down");
    }
  });

  assert.equal(board.type, "hn-ai");
  assert.equal(board.source_kind, "ai-source");
  assert.equal(board.error, "network down");
  assert.deepEqual(board.list, []);
});

test("fetchAiSourceBoard limits large feeds before writing boards", async () => {
  const source = {
    ...createAiSourceDefinitions(new Date(generatedAt)).find((item) => item.id === "openai-news"),
    maxItems: 1
  };
  const board = await fetchAiSourceBoard(source, {
    generatedAt,
    fetchImpl: async () =>
      new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <rss><channel>
          <item><title>First AI story</title><link>https://example.com/first</link></item>
          <item><title>Second AI story</title><link>https://example.com/second</link></item>
        </channel></rss>`,
        { status: 200 }
      )
  });

  assert.equal(board.list.length, 1);
  assert.equal(board.total_before_filter, 1);
  assert.deepEqual(board.list.map((item) => item.title), ["First AI story"]);
});

test("explicit social sources report missing credentials without fetching", async () => {
  let fetched = false;
  const boards = await fetchAiSourceBoards({
    generatedAt,
    sourceIds: ["x-ai-search"],
    env: {},
    delayMs: 0,
    reportMissingRequiredEnv: true,
    fetchImpl: async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    },
    sleep: async () => {}
  });

  assert.equal(fetched, false);
  assert.equal(boards.length, 1);
  assert.equal(boards[0].type, "x-ai-search");
  assert.match(boards[0].error, /X_BEARER_TOKEN/);
});

test("default source list skips token-gated social sources when credentials are missing", async () => {
  const boards = await fetchAiSourceBoards({
    generatedAt,
    env: {},
    delayMs: 0,
    fetchImpl: async (url) => {
      const target = String(url);
      if (target.includes("export.arxiv.org")) return new Response("<feed></feed>", { status: 200 });
      if (target.includes("rss.xml") || target.includes("feed.xml")) return new Response("<rss><channel></channel></rss>", { status: 200 });
      if (target.includes("api.github.com")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
      if (target.includes("algolia")) return new Response(JSON.stringify({ hits: [] }), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    },
    sleep: async () => {}
  });

  assert.equal(boards.some((board) => board.type === "x-ai-search"), false);
  assert.equal(boards.some((board) => board.type === "justone-xiaohongshu-ai"), false);
  assert.equal(boards.some((board) => board.error), false);
});

test("fetchAiSourceBoard sends X bearer token and normalizes recent search posts", async () => {
  const source = createAiSourceDefinitions(new Date(generatedAt), { X_BEARER_TOKEN: "test-x-token" }).find(
    (item) => item.id === "x-ai-search"
  );
  let observedHeaders;
  const board = await fetchAiSourceBoard(source, {
    generatedAt,
    env: { X_BEARER_TOKEN: "test-x-token" },
    fetchImpl: async (_url, init) => {
      observedHeaders = init.headers;
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "123",
              text: "OpenAI launches a new AI agent workflow",
              author_id: "42",
              created_at: generatedAt,
              public_metrics: { like_count: 12, retweet_count: 3, reply_count: 2, quote_count: 1 }
            }
          ],
          includes: { users: [{ id: "42", username: "ai_builder", name: "AI Builder" }] }
        }),
        { status: 200 }
      );
    }
  });

  assert.equal(observedHeaders.authorization, "Bearer test-x-token");
  assert.equal(board.type, "x-ai-search");
  assert.equal(board.list[0].title, "OpenAI launches a new AI agent workflow");
  assert.equal(board.list[0].url, "https://x.com/ai_builder/status/123");
  assert.match(board.list[0].hot_value, /12 likes/);
});

test("normalizes Just One cross-platform social search results", () => {
  const source = createAiSourceDefinitions(new Date(generatedAt), { JUSTONE_API_TOKEN: "test-token" }).find(
    (item) => item.id === "justone-xiaohongshu-ai"
  );
  const list = normalizeSourceItems(
    source,
    JSON.stringify({
      code: 0,
      data: {
        list: [
          {
            title: "小红书爆款 AI 笔记模板",
            desc: "AI 做图和自动化工作流正在变成小红书选题。",
            url: "https://www.xiaohongshu.com/explore/test",
            liked_count: 321,
            comment_count: 45,
            nickname: "AI运营研究员",
            publish_time: "2026-06-08 09:00:00"
          }
        ]
      }
    })
  );

  assert.equal(list.length, 1);
  assert.equal(list[0].title, "小红书爆款 AI 笔记模板");
  assert.equal(list[0].url, "https://www.xiaohongshu.com/explore/test");
  assert.match(list[0].hot_value, /321/);
  assert.deepEqual(list[0].extra.aiMatchedKeywords.slice(0, 4), ["AI", "小红书", "社媒搜索", "Xiaohongshu"]);
});

test("normalizes official Douyin video search results", () => {
  const source = createAiSourceDefinitions(new Date(generatedAt), { DOUYIN_ACCESS_TOKEN: "test-token" }).find(
    (item) => item.id === "douyin-open-search"
  );
  const list = normalizeSourceItems(
    source,
    JSON.stringify({
      err_no: 0,
      data: {
        data: {
          video_list: [
            {
              item_id: "7471252140422401337",
              title: "AI 视频模型工作流演示",
              link: "https://www.douyin.com/video/7471252140422401337",
              nickname: "AI工具箱",
              create_time: 1770000000,
              statistics: { digg_count: 9254 }
            }
          ]
        }
      }
    })
  );

  assert.equal(list.length, 1);
  assert.equal(list[0].title, "AI 视频模型工作流演示");
  assert.equal(list[0].url, "https://www.douyin.com/video/7471252140422401337");
  assert.equal(list[0].hot_value, "9254 likes");
});

test("dedupes boards by URL across sources and updates summaries", () => {
  const boards = [
    {
      type: "a",
      source_kind: "ai-source",
      list: [
        { title: "Same", url: "https://example.com/a?ref=1", extra: { aiMatchedKeywords: ["AI"] } },
        { title: "Unique", url: "https://example.com/b", extra: { aiMatchedKeywords: ["AI", "GitHub"] } }
      ],
      ai_filter_summary: { matched: 2, total: 2, keywords: ["AI", "GitHub"] }
    },
    {
      type: "b",
      source_kind: "ai-source",
      list: [{ title: "Same again", url: "https://example.com/a", extra: { aiMatchedKeywords: ["AI"] } }],
      ai_filter_summary: { matched: 1, total: 1, keywords: ["AI"] }
    }
  ];

  const deduped = dedupeBoardsByIdentity(boards);

  assert.equal(deduped[0].list.length, 2);
  assert.equal(deduped[1].list.length, 0);
  assert.deepEqual(deduped[1].ai_filter_summary, { matched: 0, total: 1, keywords: [] });
});
