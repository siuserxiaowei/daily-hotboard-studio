import test from "node:test";
import assert from "node:assert/strict";
import {
  createAiSourceDefinitions,
  dedupeBoardsByIdentity,
  fetchAiSourceBoard,
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
