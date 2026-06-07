import { PLATFORM_META } from "./platforms.js";

const HOOK_ORIENTED_PLATFORMS = new Set(["douyin", "kuaishou", "bilibili", "acfun", "weibo", "zhihu", "tieba", "hupu", "douban-group", "hn-ai"]);
const TECH_PRODUCT_PLATFORMS = new Set([
  "ithome",
  "36kr",
  "huxiu",
  "hellogithub",
  "v2ex",
  "juejin",
  "csdn",
  "sspai",
  "ifanr",
  "hf-models",
  "hf-datasets",
  "hf-spaces",
  "github-ai"
]);
const NEWS_PLATFORMS = new Set(["baidu", "toutiao", "thepaper", "qq-news", "sina-news", "netease-news", "openai-news", "deepmind-news", "hf-blog"]);
const AI_SIGNAL_PATTERN = /AI|人工智能|大模型|模型|OpenAI|Claude|Gemini|GPT|AIGC|LLM|Agent|RAG|Token|机器人|芯片|算力|推理|自动化/i;

export function parseHeat(value) {
  if (value === null || value === undefined) return 0;
  const text = String(value).replace(/,/g, "").trim();
  const firstNumber = text.match(/[\d.]+/);
  if (!firstNumber) return 0;
  const base = Number(firstNumber[0]);
  if (!Number.isFinite(base)) return 0;
  if (text.includes("亿")) return Math.round(base * 100000000);
  if (text.includes("万")) return Math.round(base * 10000);
  return Math.round(base);
}

export function normalizeItem(item, platform, updateTime) {
  const meta = PLATFORM_META[platform] || { label: platform, accent: "#111827" };
  const extra = item && typeof item.extra === "object" ? item.extra || {} : {};
  const cover = item.cover || extra.image || extra.pic || extra?.owner?.face || "";
  return {
    id: `${platform}-${item.index || 0}-${slugify(item.title || "")}`,
    platform,
    platformLabel: meta.label,
    accent: meta.accent,
    rank: Number(item.index || 0),
    title: String(item.title || "").trim(),
    url: String(item.url || ""),
    hotValue: String(item.hot_value || ""),
    hotScore: parseHeat(item.hot_value),
    description: String(extra.desc || extra.description || "").trim(),
    matchedKeywords: Array.isArray(extra.aiMatchedKeywords) ? extra.aiMatchedKeywords : [],
    sourceLabel: String(extra.sourceLabel || "").trim(),
    cover,
    updateTime
  };
}

export function normalizeBoard(board) {
  const platform = board.type;
  const updateTime = board.update_time || board.generatedAt || "";
  const list = Array.isArray(board.list) ? board.list : [];
  return {
    platform,
    platformLabel: PLATFORM_META[platform]?.label || platform,
    sourceKind: board.source_kind || "unknown",
    updateTime,
    aiFilterSummary: normalizeAiFilterSummary(board.ai_filter_summary),
    items: list.map((item) => normalizeItem(item, platform, updateTime)).filter((item) => item.title)
  };
}

function normalizeAiFilterSummary(summary) {
  const source = summary && typeof summary === "object" ? summary : {};
  return {
    matched: Number.isFinite(Number(source.matched)) ? Number(source.matched) : null,
    total: Number.isFinite(Number(source.total)) ? Number(source.total) : null,
    keywords: Array.isArray(source.keywords) ? source.keywords.map((keyword) => String(keyword)).filter(Boolean) : []
  };
}

export function buildDigest(boards, limit = 12) {
  const allItems = boards.flatMap((board) => board.items || []);
  return allItems
    .map((item) => ({
      ...item,
      signalScore: scoreItem(item)
    }))
    .sort((left, right) => right.signalScore - left.signalScore)
    .slice(0, limit);
}

export function scoreItem(item) {
  const heatScore = Math.log10(Math.max(item.hotScore, 1)) * 18;
  const rankScore = Math.max(0, 45 - item.rank * 2);
  const mediaScore = item.cover ? 8 : 0;
  const descriptionScore = item.description ? 6 : 0;
  return Math.round(heatScore + rankScore + mediaScore + descriptionScore);
}

export function buildVoiceover(digestItems, generatedAt = new Date().toISOString()) {
  const date = formatVoiceoverDate(generatedAt);
  const top = digestItems.slice(0, 5).map(normalizeVoiceoverItem);
  const bullets = top.map((item, index) => buildOutlineBullet(item, index));
  const variants = {
    thirtySecond: buildThirtySecondVariant(date, top, bullets),
    sixtySecond: buildSixtySecondVariant(date, top, bullets),
    bulletOutline: buildBulletOutlineVariant(date, top, bullets)
  };
  const assets = buildPublishingAssets(top);
  return {
    title: `${date} AI 热榜口播`,
    short: variants.thirtySecond.short,
    script: variants.sixtySecond.script,
    bullets,
    variants,
    assets
  };
}

export function makeAngle(item) {
  const description = String(item.description || "").trim();
  const hotValue = String(item.hotValue || "");
  const hotScore = Number(item.hotScore || 0);
  const matchedKeywords = Array.isArray(item.matchedKeywords) ? item.matchedKeywords.slice(0, 3) : [];
  if (description) return ensureAiAngle(description.slice(0, 80));
  if (matchedKeywords.length) return `围绕 ${matchedKeywords.join("、")} 的 AI 话题，适合做技术影响、产品机会或商业化角度拆解。`;
  if (hotScore > 1000000 || hotValue.includes("万")) return "高热度 AI 话题，适合做快速解读、观点对撞或评论区互动。";
  return "AI 相关话题排名靠前，适合做轻量资讯播报或选题观察。";
}

export function buildPublishingAssets(top) {
  const items = top.slice(0, 5);
  return {
    hooks: items.map((item) => `今天 AI 圈这条最值得盯：${item.title}`),
    captions: items.map((item) => `${item.title}｜${item.platformLabel}｜AI 角度：${stripSentenceEnd(makeAngle(item))}`),
    platformAngles: items.map((item) => ({
      platform: item.platformLabel,
      title: item.title,
      angle: makeAngle(item),
      keywords: Array.isArray(item.matchedKeywords) ? item.matchedKeywords : []
    }))
  };
}

function buildThirtySecondVariant(date, top, bullets) {
  const leadItems = top.slice(0, 3);
  const focus = top[0];
  const script = top.length
    ? [
        "大家好，这里是今日 AI 热榜 30 秒速览。",
        `截至 ${date}，今天 AI 圈先看 ${joinTitles(leadItems)}。`,
        `第一条来自${focus.platformLabel}，「${focus.title}」${heatPhrase(focus)}，重点看${stripSentenceEnd(makeAngle(focus))}。`,
        `创作方向：${platformGuidance(focus)}`
      ].join("\n")
    : [
        "大家好，这里是今日 AI 热榜 30 秒速览。",
        `截至 ${date}，当前暂无可播报 AI 热点。`,
        "建议稍后刷新数据，再安排选题和口播。"
      ].join("\n");

  return {
    id: "30s",
    label: "30 秒口播",
    durationSeconds: 30,
    title: `${date} 30 秒 AI 热榜口播`,
    short: top.length ? `今天最值得看的 ${top.length} 条 AI 热点：${joinTitles(top)}。` : "当前暂无可播报 AI 热点，建议稍后刷新数据。",
    script,
    bullets: bullets.slice(0, 3)
  };
}

function buildSixtySecondVariant(date, top, bullets) {
  const body = top.map((item, index) => formatScriptLine(item, index)).join("\n");
  const script = top.length
    ? [
        "大家好，这里是今日 AI 热榜速览。",
        "",
        body,
        "",
        `如果你只看一条，我建议先看「${top[0].title}」。它在 AI 领域同时具备讨论度和传播性，${platformGuidance(top[0])}`,
        "",
        "以上就是今天的 AI 热点更新。"
      ].join("\n")
    : [
        "大家好，这里是今日 AI 热榜速览。",
        "",
        "当前暂无可播报 AI 热点。建议稍后刷新数据，再整理今天的 AI 选题清单。",
        "",
        "以上就是今天的 AI 热点更新。"
      ].join("\n");

  return {
    id: "60s",
    label: "60 秒口播",
    durationSeconds: 60,
    title: `${date} 60 秒 AI 热榜口播`,
    short: top.length ? `60 秒看完 ${top.length} 条 AI 热榜重点：${joinTitles(top)}。` : "当前暂无可播报 AI 热点，建议稍后刷新数据。",
    script,
    bullets
  };
}

function buildBulletOutlineVariant(date, top, bullets) {
  const script = bullets.length
    ? [
        `${date} AI 热榜 bullet outline`,
        ...bullets.map(
          (bullet) =>
            `${bullet.order}. [${bullet.platform}] ${bullet.title}\n   - 热度：${bullet.hotValue || "未标注"}\n   - 角度：${bullet.angle}\n   - 转场：${bullet.cue}`
        )
      ].join("\n")
    : `${date} AI 热榜 bullet outline\n1. 当前暂无可播报 AI 热点，先刷新数据再输出提纲。`;

  return {
    id: "bullet-outline",
    label: "Bullet outline",
    format: "outline",
    title: `${date} AI 热榜口播提纲`,
    short: top.length ? `按平台、热度和选题角度整理 ${top.length} 条 AI 热点。` : "当前暂无可播报 AI 热点，建议稍后刷新数据。",
    script,
    bullets
  };
}

function buildOutlineBullet(item, index) {
  return {
    order: index + 1,
    title: item.title,
    platform: item.platformLabel,
    hotValue: item.hotValue,
    angle: makeAngle(item),
    cue: index === 0 ? "先抛出最强话题，再补充热度来源。" : "承接上一条，快速说明为什么值得关注。"
  };
}

function formatScriptLine(item, index) {
  return `${index + 1}. ${item.platformLabel}：${item.title}${heatPhrase(item)}。看点是${stripSentenceEnd(makeAngle(item))}。${platformGuidance(item)}`;
}

function normalizeVoiceoverItem(item) {
  return {
    ...item,
    title: String(item.title || "未命名热点").trim(),
    platformLabel: String(item.platformLabel || item.platform || "热榜").trim(),
    hotValue: String(item.hotValue || "").trim(),
    description: String(item.description || "").trim(),
    hotScore: Number(item.hotScore || 0),
    matchedKeywords: Array.isArray(item.matchedKeywords) ? item.matchedKeywords : []
  };
}

function platformGuidance(item) {
  const platform = String(item?.platform || "").toLowerCase();
  if (HOOK_ORIENTED_PLATFORMS.has(platform)) {
    return "更适合做短视频开场钩子：先抛出 AI 变化，再用一个用户场景承接讨论。";
  }
  if (TECH_PRODUCT_PLATFORMS.has(platform)) {
    return "更适合做技术/产品解读：先讲 AI 能力或架构变化，再落到产品机会和落地限制。";
  }
  if (NEWS_PLATFORMS.has(platform)) {
    return "更适合做 AI 新闻快评：先核实事实和时间线，再解释它会影响哪些用户或行业。";
  }
  return "适合做 AI 选题观察：先提炼变化，再补充技术、产品或商业化影响。";
}

function ensureAiAngle(text) {
  if (!text) return "AI 相关话题排名靠前，适合做轻量资讯播报或选题观察。";
  return AI_SIGNAL_PATTERN.test(text) ? text : `AI 角度：${text}`;
}

function formatVoiceoverDate(generatedAt) {
  const date = new Date(generatedAt);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai"
  }).format(safeDate);
}

function joinTitles(items) {
  return items.map((item) => item.title).join("、");
}

function heatPhrase(item) {
  return item.hotValue ? `，热度 ${item.hotValue}` : "";
}

function stripSentenceEnd(text) {
  return String(text).replace(/[。！？.!?]+$/g, "");
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
