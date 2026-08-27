import test from "node:test";
import assert from "node:assert/strict";
import { publishBrief } from "../scripts/publish-brief.mjs";

const brief = {
  generatedAt: "2026-08-27T00:30:00.000Z",
  decision: "SEND",
  receipts: [
    {
      status: "NEW",
      title: "OpenAI 发布新模型",
      whyItMatters: "一手来源已确认。",
      evidence: [{ label: "OpenAI", url: "https://openai.com/index/new-model", firstParty: true }]
    }
  ],
  unverified: []
};

test("dry-run renders the payload without making a request", async () => {
  let calls = 0;
  const result = await publishBrief({
    brief,
    enabled: false,
    fetchImpl: async () => {
      calls += 1;
      return new Response(null, { status: 204 });
    }
  });

  assert.equal(result.status, "DRY_RUN");
  assert.equal(calls, 0);
  assert.match(result.text, /今天真的变了什么/);
  assert.match(result.text, /OpenAI 发布新模型/);
});

test("enabled webhook posts one JSON message", async () => {
  const calls = [];
  const result = await publishBrief({
    brief,
    enabled: true,
    webhookUrl: "https://hooks.example.test/brief",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response("ok", { status: 200 });
    }
  });

  assert.equal(result.status, "SENT");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://hooks.example.test/brief");
  assert.equal(calls[0].init.method, "POST");
  assert.match(calls[0].init.headers["content-type"], /application\/json/);
  assert.match(JSON.parse(calls[0].init.body).text, /OpenAI 发布新模型/);
});

test("enabled mode fails closed when the webhook URL is missing or non-HTTPS", async () => {
  await assert.rejects(() => publishBrief({ brief, enabled: true, webhookUrl: "" }), /WEBHOOK_URL/);
  await assert.rejects(
    () => publishBrief({ brief, enabled: true, webhookUrl: "http://hooks.example.test/brief" }),
    /HTTPS/
  );
});

test("non-SEND decisions never call the webhook", async () => {
  let calls = 0;
  const result = await publishBrief({
    brief: { ...brief, decision: "QUIET_DAY", receipts: [] },
    enabled: true,
    webhookUrl: "https://hooks.example.test/brief",
    fetchImpl: async () => {
      calls += 1;
      return new Response(null, { status: 204 });
    }
  });

  assert.equal(result.status, "SKIPPED");
  assert.equal(calls, 0);
});
