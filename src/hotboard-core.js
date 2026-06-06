import { PLATFORM_META } from "./platforms.js";

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
    updateTime,
    items: list.map((item) => normalizeItem(item, platform, updateTime)).filter((item) => item.title)
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
  return {
    title: `${date} 每日热榜口播`,
    short: variants.thirtySecond.short,
    script: variants.sixtySecond.script,
    bullets,
    variants
  };
}

export function makeAngle(item) {
  const description = String(item.description || "").trim();
  const hotValue = String(item.hotValue || "");
  const hotScore = Number(item.hotScore || 0);
  if (description) return description.slice(0, 80);
  if (hotScore > 1000000 || hotValue.includes("万")) return "高热度话题，适合做快速解读、观点对撞或评论区互动。";
  return "平台排名靠前，适合做轻量资讯播报或选题观察。";
}

function buildThirtySecondVariant(date, top, bullets) {
  const leadItems = top.slice(0, 3);
  const focus = top[0];
  const script = top.length
    ? [
        "大家好，这里是今日热榜 30 秒速览。",
        `截至 ${date}，今天先看 ${joinTitles(leadItems)}。`,
        `第一条来自${focus.platformLabel}，「${focus.title}」${heatPhrase(focus)}，重点看${stripSentenceEnd(makeAngle(focus))}。`,
        "适合先做快讯、评论区互动和后续选题跟踪。"
      ].join("\n")
    : [
        "大家好，这里是今日热榜 30 秒速览。",
        `截至 ${date}，当前暂无可播报热点。`,
        "建议稍后刷新数据，再安排选题和口播。"
      ].join("\n");

  return {
    id: "30s",
    label: "30 秒口播",
    durationSeconds: 30,
    title: `${date} 30 秒热榜口播`,
    short: top.length ? `今天最值得看的 ${top.length} 条热点：${joinTitles(top)}。` : "当前暂无可播报热点，建议稍后刷新数据。",
    script,
    bullets: bullets.slice(0, 3)
  };
}

function buildSixtySecondVariant(date, top, bullets) {
  const body = top.map((item, index) => formatScriptLine(item, index)).join("\n");
  const script = top.length
    ? [
        "大家好，这里是今日热榜速览。",
        "",
        body,
        "",
        `如果你只看一条，我建议先看「${top[0].title}」。它同时具备高讨论度和强传播性，适合继续做选题拆解。`,
        "",
        "以上就是今天的热点更新。"
      ].join("\n")
    : [
        "大家好，这里是今日热榜速览。",
        "",
        "当前暂无可播报热点。建议稍后刷新数据，再整理今天的选题清单。",
        "",
        "以上就是今天的热点更新。"
      ].join("\n");

  return {
    id: "60s",
    label: "60 秒口播",
    durationSeconds: 60,
    title: `${date} 60 秒热榜口播`,
    short: top.length ? `60 秒看完 ${top.length} 条热榜重点：${joinTitles(top)}。` : "当前暂无可播报热点，建议稍后刷新数据。",
    script,
    bullets
  };
}

function buildBulletOutlineVariant(date, top, bullets) {
  const script = bullets.length
    ? [
        `${date} 热榜 bullet outline`,
        ...bullets.map(
          (bullet) =>
            `${bullet.order}. [${bullet.platform}] ${bullet.title}\n   - 热度：${bullet.hotValue || "未标注"}\n   - 角度：${bullet.angle}\n   - 转场：${bullet.cue}`
        )
      ].join("\n")
    : `${date} 热榜 bullet outline\n1. 当前暂无可播报热点，先刷新数据再输出提纲。`;

  return {
    id: "bullet-outline",
    label: "Bullet outline",
    format: "outline",
    title: `${date} 热榜口播提纲`,
    short: top.length ? `按平台、热度和选题角度整理 ${top.length} 条热点。` : "当前暂无可播报热点，建议稍后刷新数据。",
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
  return `${index + 1}. ${item.platformLabel}：${item.title}${heatPhrase(item)}。看点是${stripSentenceEnd(makeAngle(item))}。`;
}

function normalizeVoiceoverItem(item) {
  return {
    ...item,
    title: String(item.title || "未命名热点").trim(),
    platformLabel: String(item.platformLabel || item.platform || "热榜").trim(),
    hotValue: String(item.hotValue || "").trim(),
    description: String(item.description || "").trim(),
    hotScore: Number(item.hotScore || 0)
  };
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
