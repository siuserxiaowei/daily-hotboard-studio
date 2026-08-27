export const CHANGE_STATUS = Object.freeze({
  NEW: "NEW",
  CHANGED: "CHANGED",
  CORRECTED: "CORRECTED",
  UNVERIFIED: "UNVERIFIED"
});

export const BRIEF_DECISION = Object.freeze({
  SEND: "SEND",
  HOLD: "HOLD",
  QUIET_DAY: "QUIET_DAY"
});

const FIRST_PARTY_SOURCE_TYPES = new Set(["openai-news", "deepmind-news", "hf-blog"]);
const PRIMARY_SOURCE_TYPES = new Set(["arxiv-ai", "hf-daily-papers"]);
const FIRST_PARTY_DOMAINS = ["openai.com", "deepmind.google", "blog.google"];
const PRIMARY_DOMAINS = ["arxiv.org", "huggingface.co"];
const CORRECTION_PATTERN = /更正|纠正|勘误|不准确|并非|否认|撤回|修订|correction|corrected|incorrect|den(?:y|ies|ied)|withdrawn|retract(?:ed|ion)/i;
const STATUS_PRIORITY = {
  [CHANGE_STATUS.CORRECTED]: 0,
  [CHANGE_STATUS.CHANGED]: 1,
  [CHANGE_STATUS.NEW]: 2,
  [CHANGE_STATUS.UNVERIFIED]: 3
};
const SOURCE_PRIORITY = { official: 0, primary: 1, community: 2 };
const TITLE_NOISE = new Set([
  "a",
  "an",
  "the",
  "to",
  "for",
  "in",
  "on",
  "of",
  "and",
  "with",
  "from",
  "new",
  "ai",
  "artificial",
  "intelligence",
  "research",
  "data",
  "using",
  "system",
  "systems",
  "model",
  "models",
  "large",
  "language",
  "llm",
  "llms",
  "agent",
  "agents",
  "正式",
  "发布",
  "推出",
  "上线",
  "更新",
  "全新",
  "带来",
  "模型",
  "消息",
  "最新",
  "today",
  "launch",
  "launches",
  "release",
  "released",
  "announces",
  "announcement",
  "update"
]);
const KNOWN_ENTITY_TOKENS = new Set([
  "openai",
  "chatgpt",
  "gpt",
  "anthropic",
  "claude",
  "google",
  "deepmind",
  "gemini",
  "microsoft",
  "copilot",
  "meta",
  "llama",
  "mistral",
  "qwen",
  "deepseek",
  "kimi",
  "huggingface",
  "nvidia",
  "github"
]);

export function buildChangeBrief(currentSnapshot, previousSnapshot = null, options = {}) {
  const maxReceipts = normalizeLimit(options.maxReceipts, 3);
  const currentSignals = flattenSnapshot(currentSnapshot);
  const previousSignals = flattenSnapshot(previousSnapshot);
  const currentEvents = clusterSignals(currentSignals);
  const previousEvents = clusterSignals(previousSignals);
  const changes = [];

  for (const event of currentEvents) {
    const previous = findMatchingEvent(event, previousEvents);
    const verified = event.signals.some((signal) => signal.evidenceTier !== "community");
    let status;

    if (!previous) {
      status = verified ? CHANGE_STATUS.NEW : CHANGE_STATUS.UNVERIFIED;
    } else if (!hasMaterialChange(event, previous)) {
      continue;
    } else if (event.signals.some((signal) => CORRECTION_PATTERN.test(`${signal.title} ${signal.description}`))) {
      status = verified ? CHANGE_STATUS.CORRECTED : CHANGE_STATUS.UNVERIFIED;
    } else {
      status = verified ? CHANGE_STATUS.CHANGED : CHANGE_STATUS.UNVERIFIED;
    }

    changes.push(toReceipt(event, status));
  }

  changes.sort(compareReceipts);
  const verifiedChanges = changes.filter((change) => change.verified);
  const unverified = changes.filter((change) => !change.verified).slice(0, 6);
  const receipts = verifiedChanges.slice(0, maxReceipts);
  const decision = receipts.length
    ? BRIEF_DECISION.SEND
    : unverified.length
      ? BRIEF_DECISION.HOLD
      : BRIEF_DECISION.QUIET_DAY;
  const generatedAt = String(currentSnapshot?.generatedAt || new Date().toISOString());
  return {
    schemaVersion: 1,
    generatedAt,
    comparedWith: previousSnapshot?.generatedAt || null,
    decision,
    decisionLabel: decisionLabel(decision),
    promise: "只推送经一手或原始来源核验、且相较上一期发生实质变化的 AI 事件；最多 3 条。",
    funnel: {
      signals: currentSignals.length,
      events: changes.length,
      verified: verifiedChanges.length,
      receipts: receipts.length
    },
    receipts,
    unverified,
    suppressed: Math.max(0, currentEvents.length - receipts.length - unverified.length),
    methodology: {
      comparison: "previous-snapshot",
      ranking: "correction-first, then evidence tier, source publication time and deterministic title; heat, Stars and ranks are never compared across sources",
      statuses: Object.values(CHANGE_STATUS)
    }
  };
}

export function buildBriefRss(brief, options = {}) {
  const siteUrl = String(options.siteUrl || "https://siuserxiaowei.github.io/daily-hotboard-studio/");
  const feedUrl = String(options.feedUrl || new URL("data/change-brief.xml", siteUrl).href);
  const generatedAt = validDate(brief?.generatedAt).toUTCString();
  const items = (brief?.receipts || []).map((receipt) => {
    const link = receipt.evidence.find((evidence) => evidence.firstParty)?.url || receipt.evidence[0]?.url || siteUrl;
    const description = `${receipt.status}｜${receipt.whyItMatters}`;
    return [
      "    <item>",
      `      <title>${escapeXml(receipt.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="false">${escapeXml(receipt.id)}</guid>`,
      `      <pubDate>${generatedAt}</pubDate>`,
      `      <description>${escapeXml(description)}</description>`,
      "    </item>"
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>AI讯息｜今天真的变了什么</title>",
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(brief?.promise || "每日 AI 变化核验简报")}</description>`,
    `    <lastBuildDate>${generatedAt}</lastBuildDate>`,
    `    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    "  </channel>",
    "</rss>",
    ""
  ].join("\n");
}

export function flattenSnapshot(snapshot) {
  const boards = Array.isArray(snapshot?.boards) ? snapshot.boards : [];
  return boards.flatMap((board) => {
    const sourceType = String(board?.type || "unknown");
    const sourceKind = String(board?.source_kind || "unknown");
    return (Array.isArray(board?.list) ? board.list : [])
      .map((item) => normalizeSignal(item, { sourceType, sourceKind, boardUpdatedAt: board?.update_time }))
      .filter((signal) => signal.title);
  });
}

function normalizeSignal(item, context) {
  const extra = item && typeof item.extra === "object" && item.extra ? item.extra : {};
  const url = String(item?.url || extra.url || "").trim();
  const sourceType = context.sourceType;
  const evidenceTier = classifyEvidence(sourceType, url);
  return {
    title: String(item?.title || "").trim(),
    description: String(extra.desc || extra.description || "").trim(),
    url,
    canonicalUrl: canonicalizeUrl(url),
    eventId: String(extra.eventId || extra.event_id || "").trim(),
    sourceType,
    sourceKind: context.sourceKind,
    sourceLabel: String(extra.sourceLabel || extra.source || sourceType).trim(),
    publishedAt: String(extra.publishedAt || context.boardUpdatedAt || "").trim(),
    evidenceTier,
    firstParty: evidenceTier !== "community",
    titleTokens: titleTokens(item?.title)
  };
}

function classifyEvidence(sourceType, url) {
  if (FIRST_PARTY_SOURCE_TYPES.has(sourceType)) return "official";
  if (PRIMARY_SOURCE_TYPES.has(sourceType)) return "primary";
  if (domainMatches(url, FIRST_PARTY_DOMAINS)) return "official";
  if (domainMatches(url, PRIMARY_DOMAINS)) return "primary";
  return "community";
}

function clusterSignals(signals) {
  const clusters = [];
  for (const signal of [...signals].sort(compareSignals)) {
    const cluster = clusters.find((candidate) => candidate.signals.some((existing) => signalsMatch(signal, existing)));
    if (cluster) {
      cluster.signals.push(signal);
      cluster.signals.sort(compareSignals);
      cluster.urls = new Set(cluster.signals.map((item) => item.canonicalUrl).filter(Boolean));
    } else {
      clusters.push({
        signals: [signal],
        urls: new Set(signal.canonicalUrl ? [signal.canonicalUrl] : [])
      });
    }
  }
  return clusters;
}

function findMatchingEvent(event, candidates) {
  return candidates.find((candidate) =>
    event.signals.some((left) => candidate.signals.some((right) => signalsMatchAcrossSnapshots(left, right)))
  );
}

function signalsMatchAcrossSnapshots(left, right) {
  if (left.eventId && right.eventId && left.eventId === right.eventId) return true;
  if (left.canonicalUrl && right.canonicalUrl && left.canonicalUrl === right.canonicalUrl) return true;
  const leftTitle = normalizeText(left.title);
  return Boolean(leftTitle) && leftTitle === normalizeText(right.title);
}

function signalsMatch(left, right) {
  if (left.eventId && right.eventId && left.eventId === right.eventId) return true;
  if (left.canonicalUrl && right.canonicalUrl && left.canonicalUrl === right.canonicalUrl) return true;
  const similarity = jaccard(left.titleTokens, right.titleTokens);
  const sharedIdentity = intersection(identityTokens(left.titleTokens), identityTokens(right.titleTokens));
  if (sharedIdentity.size >= 2 && ([...sharedIdentity].some(hasVersionMarker) || similarity >= 0.35)) return true;
  return intersectionSize(left.titleTokens, right.titleTokens) >= 3 && similarity >= 0.64;
}

function hasMaterialChange(current, previous) {
  const currentEvidence = materialEvidence(current);
  const previousEvidence = materialEvidence(previous);
  return currentEvidence.join("\n") !== previousEvidence.join("\n");
}

function materialEvidence(event) {
  const authoritative = event.signals.filter((signal) => signal.evidenceTier !== "community");
  const source = authoritative.length ? authoritative : event.signals;
  return source
    .map((signal) =>
      [signal.canonicalUrl, normalizeText(signal.title), normalizeText(signal.description), signal.evidenceTier].join("|")
    )
    .sort();
}

function toReceipt(event, status) {
  const signals = [...event.signals].sort(compareSignals);
  const lead = signals[0];
  const verified = signals.some((signal) => signal.evidenceTier !== "community");
  const evidence = signals.map((signal) => ({
    title: signal.title,
    label: signal.sourceLabel || signal.sourceType,
    sourceType: signal.sourceType,
    tier: signal.evidenceTier,
    url: signal.url,
    publishedAt: signal.publishedAt || null,
    firstParty: signal.firstParty
  }));
  const identity = lead.eventId || lead.canonicalUrl || [...lead.titleTokens].sort().join("-") || lead.title;
  return {
    id: `event-${fnv1a(identity)}`,
    status,
    title: lead.title,
    summary: lead.description || statusSummary(status),
    whyItMatters: whyItMatters(status, evidence),
    verified,
    evidence
  };
}

function compareReceipts(left, right) {
  return (
    STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status] ||
    bestEvidencePriority(left) - bestEvidencePriority(right) ||
    latestEvidenceTime(right) - latestEvidenceTime(left) ||
    left.title.localeCompare(right.title, "zh-CN") ||
    left.id.localeCompare(right.id)
  );
}

function compareSignals(left, right) {
  return (
    SOURCE_PRIORITY[left.evidenceTier] - SOURCE_PRIORITY[right.evidenceTier] ||
    left.title.localeCompare(right.title, "zh-CN") ||
    left.canonicalUrl.localeCompare(right.canonicalUrl)
  );
}

function bestEvidencePriority(receipt) {
  return Math.min(...receipt.evidence.map((evidence) => SOURCE_PRIORITY[evidence.tier] ?? 9));
}

function latestEvidenceTime(receipt) {
  return Math.max(
    0,
    ...receipt.evidence.map((evidence) => {
      const time = Date.parse(evidence.publishedAt || "");
      return Number.isFinite(time) ? time : 0;
    })
  );
}

function titleTokens(value) {
  const normalized = normalizeText(value);
  const latin = normalized.match(/[a-z]+(?:[-._]?[a-z0-9]+)*/g) || [];
  const hanRuns = normalized.match(/[\p{Script=Han}]+/gu) || [];
  const han = hanRuns.flatMap((run) => {
    if (run.length <= 2) return [run];
    return Array.from({ length: run.length - 1 }, (_, index) => run.slice(index, index + 2));
  });
  return new Set([...latin, ...han].filter((token) => token && !TITLE_NOISE.has(token)));
}

function identityTokens(tokens) {
  return new Set([...tokens].filter((token) => KNOWN_ENTITY_TOKENS.has(token) || hasVersionMarker(token)));
}

function hasVersionMarker(token) {
  return /[a-z]/i.test(token) && /\d/.test(token);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\p{Script=Han}._-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.href;
  } catch {
    return String(value).trim();
  }
}

function domainMatches(value, domains) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function intersectionSize(left, right) {
  let count = 0;
  for (const item of left) if (right.has(item)) count += 1;
  return count;
}

function intersection(left, right) {
  return new Set([...left].filter((item) => right.has(item)));
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  const intersection = intersectionSize(left, right);
  return intersection / (left.size + right.size - intersection);
}

function whyItMatters(status, evidence) {
  const official = evidence.filter((item) => item.tier === "official").length;
  const primary = evidence.filter((item) => item.tier === "primary").length;
  const proof = official ? `${official} 个一手来源` : `${primary} 个原始来源`;
  if (status === CHANGE_STATUS.CORRECTED) return `${proof}确认了纠错，旧结论需要立即停止传播。`;
  if (status === CHANGE_STATUS.CHANGED) return `${proof}确认事实已发生实质变化，值得更新原有判断。`;
  if (status === CHANGE_STATUS.NEW) return `${proof}确认这是上一期之后出现的新事件。`;
  return "当前只有社区或热榜信号，暂不作为事实推送。";
}

function statusSummary(status) {
  if (status === CHANGE_STATUS.CORRECTED) return "一手来源对既有信息作出更正。";
  if (status === CHANGE_STATUS.CHANGED) return "一手来源中的关键信息发生变化。";
  if (status === CHANGE_STATUS.NEW) return "相较上一期出现的新变化。";
  return "尚未找到足够的一手证据。";
}

function decisionLabel(decision) {
  if (decision === BRIEF_DECISION.SEND) return "发送变化回执";
  if (decision === BRIEF_DECISION.HOLD) return "暂缓：等待一手证据";
  return "静默日：没有值得打扰你的变化";
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function normalizeLimit(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function validDate(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
