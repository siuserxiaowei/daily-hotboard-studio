import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export async function publishBrief(options = {}) {
  const brief = options.brief || {};
  const enabled = Boolean(options.enabled);
  const webhookUrl = String(options.webhookUrl || "").trim();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const text = formatBriefText(brief);

  if (brief.decision !== "SEND") {
    return { status: "SKIPPED", reason: brief.decision || "NO_DECISION", text };
  }
  if (!enabled) return { status: "DRY_RUN", text };
  if (!webhookUrl) throw new Error("BRIEF_WEBHOOK_URL is required when push is enabled");
  if (!webhookUrl.startsWith("https://")) throw new Error("Webhook delivery requires an HTTPS URL");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch is not available in this Node runtime");

  const payload = {
    text,
    generatedAt: brief.generatedAt,
    decision: brief.decision,
    receipts: brief.receipts || []
  };
  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Webhook delivery failed with HTTP ${response.status}`);
  return { status: "SENT", responseStatus: response.status, text };
}

export function formatBriefText(brief) {
  const date = formatChinaDate(brief?.generatedAt);
  const lines = [`AI讯息｜${date} 今天真的变了什么`, `决策：${brief?.decision || "QUIET_DAY"}`];
  const receipts = Array.isArray(brief?.receipts) ? brief.receipts : [];
  if (!receipts.length) {
    lines.push(brief?.decision === "HOLD" ? "有新信号，但缺少一手证据，今天暂不推送。" : "没有值得打扰你的实质变化。");
    return lines.join("\n");
  }
  receipts.forEach((receipt, index) => {
    const link = receipt.evidence?.find((item) => item.firstParty)?.url || receipt.evidence?.[0]?.url || "";
    lines.push(`${index + 1}. [${receipt.status}] ${receipt.title}`);
    lines.push(`   ${receipt.whyItMatters}`);
    if (link) lines.push(`   证据：${link}`);
  });
  lines.push("只报变化，不做跨平台热度混排；每天最多 3 条。");
  return lines.join("\n");
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  const briefPath = process.env.BRIEF_PATH || join(root, "data", "change-brief.json");
  const brief = JSON.parse(await readFile(briefPath, "utf8"));
  const result = await publishBrief({
    brief,
    enabled: parseBoolean(process.env.BRIEF_PUSH_ENABLED),
    webhookUrl: process.env.BRIEF_WEBHOOK_URL
  });
  process.stdout.write(`${result.status}\n${result.text}\n`);
}

function formatChinaDate(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "日期未知";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function isDirectExecution(moduleUrl, argvPath) {
  return Boolean(argvPath) && moduleUrl === pathToFileURL(argvPath).href;
}
